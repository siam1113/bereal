import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import type { AvailabilityStatus, ProfessionalStage } from "@prisma/client";

export async function getProfileBySlug(slug: string) {
  return prisma.personProfile.findUnique({
    where: { slug },
    include: {
      personSkills: { include: { skill: true }, orderBy: { isPrimary: "desc" } },
      portfolioItems: { where: { visibility: "PUBLIC" }, orderBy: { createdAt: "desc" } },
      experienceEntries: { orderBy: { startDate: "desc" } },
      user: { select: { id: true, image: true } },
    },
  });
}

export async function getOwnProfile() {
  const user = await requireUser();
  return getProfileByUserId(user.id);
}

/**
 * Same as `getOwnProfile()` but takes an explicit `userId` instead of resolving it from
 * the session — used by the versioned API (`/api/v1/*`), which may have authenticated
 * the caller via a scoped API key rather than a browser session (see
 * `src/lib/api/auth.ts`). Keeping identity resolution out of this function means it works
 * identically no matter which auth path resolved the caller.
 */
export async function getProfileByUserId(userId: string) {
  return prisma.personProfile.findUniqueOrThrow({
    where: { userId },
    include: {
      personSkills: { include: { skill: true }, orderBy: { isPrimary: "desc" } },
    },
  });
}

interface ProfileUpdateInput {
  displayName?: string;
  bio?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  languages?: string[];
  availability?: AvailabilityStatus;
}

export async function updateOwnProfile(input: ProfileUpdateInput) {
  const user = await requireUser();
  return updateProfileByUserId(user.id, input);
}

/** See `getProfileByUserId()` — same explicit-identity rationale. */
export async function updateProfileByUserId(userId: string, input: ProfileUpdateInput) {
  return prisma.personProfile.update({
    where: { userId },
    data: input,
  });
}

/**
 * A profile has at most one primary skill. The DB doesn't enforce this (PersonSkill has
 * no partial-unique-index support for isPrimary in this schema), so we demote any
 * existing primary in the same transaction.
 */
export async function setPrimarySkill(skillId: string) {
  const user = await requireUser();
  const profile = await prisma.personProfile.findUniqueOrThrow({ where: { userId: user.id } });

  await prisma.$transaction(async (tx) => {
    await tx.personSkill.updateMany({
      where: { personProfileId: profile.id, isPrimary: true },
      data: { isPrimary: false },
    });

    await tx.personSkill.upsert({
      where: { personProfileId_skillId: { personProfileId: profile.id, skillId } },
      update: { isPrimary: true },
      create: { personProfileId: profile.id, skillId, isPrimary: true, stage: "LEARNING" },
    });
  });
}

export async function addSecondarySkill(skillId: string) {
  const user = await requireUser();
  const profile = await prisma.personProfile.findUniqueOrThrow({ where: { userId: user.id } });

  return prisma.personSkill.upsert({
    where: { personProfileId_skillId: { personProfileId: profile.id, skillId } },
    update: {},
    create: { personProfileId: profile.id, skillId, isPrimary: false, stage: "LEARNING" },
  });
}

export async function removeSkill(skillId: string) {
  const user = await requireUser();
  const profile = await prisma.personProfile.findUniqueOrThrow({ where: { userId: user.id } });

  await prisma.personSkill.delete({
    where: { personProfileId_skillId: { personProfileId: profile.id, skillId } },
  });
}

/**
 * Admin/manual stage override is Vertical E's job (admin/stage-rules). This is the plain
 * read-side accessor other verticals or pages might need.
 */
export async function getPersonSkills(personProfileId: string) {
  return prisma.personSkill.findMany({
    where: { personProfileId },
    include: { skill: true },
    orderBy: { isPrimary: "desc" },
  });
}

export type { ProfessionalStage };
