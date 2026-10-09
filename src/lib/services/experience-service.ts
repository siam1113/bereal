import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

interface ExperienceInput {
  title: string;
  organizationName: string;
  linkedBusinessId?: string | null;
  startDate: string;
  endDate?: string | null;
  description?: string;
}

async function ownProfileId(userId: string) {
  const profile = await prisma.personProfile.findUniqueOrThrow({ where: { userId } });
  return profile.id;
}

export async function listOwnExperience() {
  const user = await requireUser();
  const profileId = await ownProfileId(user.id);
  return prisma.experienceEntry.findMany({
    where: { personProfileId: profileId },
    orderBy: { startDate: "desc" },
  });
}

export async function createExperience(input: ExperienceInput) {
  const user = await requireUser();
  const profileId = await ownProfileId(user.id);

  return prisma.experienceEntry.create({
    data: {
      personProfileId: profileId,
      title: input.title,
      organizationName: input.organizationName,
      linkedBusinessId: input.linkedBusinessId ?? undefined,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      description: input.description,
    },
  });
}

export async function updateExperience(id: string, input: ExperienceInput) {
  const user = await requireUser();
  const profileId = await ownProfileId(user.id);
  const existing = await prisma.experienceEntry.findUnique({ where: { id } });
  if (!existing || existing.personProfileId !== profileId) throw new Error("Not found");

  return prisma.experienceEntry.update({
    where: { id },
    data: {
      title: input.title,
      organizationName: input.organizationName,
      linkedBusinessId: input.linkedBusinessId ?? undefined,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      description: input.description,
    },
  });
}

export async function deleteExperience(id: string) {
  const user = await requireUser();
  const profileId = await ownProfileId(user.id);
  const existing = await prisma.experienceEntry.findUnique({ where: { id } });
  if (!existing || existing.personProfileId !== profileId) throw new Error("Not found");

  await prisma.experienceEntry.delete({ where: { id } });
}
