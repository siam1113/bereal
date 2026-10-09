import { prisma } from "@/lib/prisma";
import type { AvailabilityStatus, GeoScope, ProfessionalStage } from "@prisma/client";

export interface SearchPeopleInput {
  query?: string;
  skillId?: string;
  geoScope?: GeoScope;
  nearProfileId?: string;
  availability?: AvailabilityStatus;
  stage?: ProfessionalStage;
  limit?: number;
}

export type SkillMatchKind = "primary" | "secondary" | "none";
export type GeoMatchKind = "local" | "region" | "global" | "unknown";

export interface SearchPersonResult {
  profileId: string;
  userId: string;
  slug: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  availability: AvailabilityStatus;
  primarySkillName: string | null;
  matchedSkillName: string | null;
  stage: ProfessionalStage | null;
  portfolioCount: number;
  matchReasons: {
    skillMatch: SkillMatchKind;
    geoMatch: GeoMatchKind;
    hasPortfolio: boolean;
    availability: AvailabilityStatus;
  };
}

/**
 * Explainable people search: every result carries the concrete reasons it matched
 * (skillMatch / geoMatch / hasPortfolio / availability) instead of a single blended
 * trust/relevance score — the plan explicitly forbids an opaque single score (section 2.12).
 * Secondary skills are searched exactly like primary skills, just labeled differently in
 * the result (section 2.3: secondary skills must be fully searchable).
 */
export async function searchPeople(input: SearchPeopleInput): Promise<SearchPersonResult[]> {
  const limit = input.limit ?? 30;

  let geoFilter: { city?: string; region?: string; country?: string } | null = null;
  if (input.nearProfileId && input.geoScope && input.geoScope !== "GLOBAL") {
    const near = await prisma.personProfile.findUnique({
      where: { id: input.nearProfileId },
      select: { city: true, region: true, country: true },
    });
    if (near) {
      geoFilter =
        input.geoScope === "LOCAL"
          ? { city: near.city ?? undefined }
          : { region: near.region ?? undefined, country: near.country ?? undefined };
    }
  }

  const profiles = await prisma.personProfile.findMany({
    where: {
      user: { status: "ACTIVE" },
      ...(input.availability ? { availability: input.availability } : {}),
      ...(geoFilter?.city ? { city: geoFilter.city } : {}),
      ...(geoFilter?.region ? { region: geoFilter.region } : {}),
      ...(geoFilter?.country && !geoFilter.city ? { country: geoFilter.country } : {}),
      ...(input.query
        ? {
            OR: [
              { displayName: { contains: input.query, mode: "insensitive" } },
              { bio: { contains: input.query, mode: "insensitive" } },
              {
                personSkills: {
                  some: {
                    skill: {
                      OR: [
                        { name: { contains: input.query, mode: "insensitive" } },
                        { aliases: { some: { alias: { contains: input.query, mode: "insensitive" } } } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(input.skillId ? { personSkills: { some: { skillId: input.skillId } } } : {}),
      ...(input.stage ? { personSkills: { some: { stage: input.stage } } } : {}),
    },
    include: {
      personSkills: { include: { skill: true } },
      _count: { select: { portfolioItems: true } },
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return profiles.map((profile) => {
    const primary = profile.personSkills.find((ps) => ps.isPrimary);
    let matched = input.skillId
      ? profile.personSkills.find((ps) => ps.skillId === input.skillId)
      : profile.personSkills.find(
          (ps) =>
            input.query &&
            (ps.skill.name.toLowerCase().includes(input.query.toLowerCase()) ||
              (primary && ps.id === primary.id)),
        );
    if (!matched) matched = primary;

    const skillMatch: SkillMatchKind = !matched ? "none" : matched.isPrimary ? "primary" : "secondary";

    let geoMatch: GeoMatchKind = "unknown";
    if (geoFilter?.city && profile.city === geoFilter.city) geoMatch = "local";
    else if (geoFilter?.region && profile.region === geoFilter.region) geoMatch = "region";
    else if (input.geoScope === "GLOBAL") geoMatch = "global";

    return {
      profileId: profile.id,
      userId: profile.userId,
      slug: profile.slug,
      displayName: profile.displayName,
      bio: profile.bio,
      city: profile.city,
      region: profile.region,
      country: profile.country,
      availability: profile.availability,
      primarySkillName: primary?.skill.name ?? null,
      matchedSkillName: matched?.skill.name ?? null,
      stage: matched?.stage ?? primary?.stage ?? null,
      portfolioCount: profile._count.portfolioItems,
      matchReasons: {
        skillMatch,
        geoMatch,
        hasPortfolio: profile._count.portfolioItems > 0,
        availability: profile.availability,
      },
    };
  });
}

export async function searchSkillsForPicker(query: string) {
  return prisma.skill.findMany({
    where: {
      isApproved: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { aliases: { some: { alias: { contains: query, mode: "insensitive" } } } },
      ],
    },
    take: 20,
    orderBy: { name: "asc" },
  });
}
