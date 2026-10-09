import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AvailabilityStatus, GeoScope, ProfessionalStage } from "@prisma/client";

export interface SearchPeopleInput {
  query?: string;
  skillId?: string;
  geoScope?: GeoScope;
  nearProfileId?: string;
  availability?: AvailabilityStatus;
  stage?: ProfessionalStage;
  /** Max rows per page. Defaults to 20, capped at 50. */
  limit?: number;
  /** Row offset for pagination. Defaults to 0. */
  offset?: number;
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

export interface SearchPeopleResult {
  results: SearchPersonResult[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
// Trigram similarity threshold for typo-tolerant fuzzy matching (pg_trgm's own default
// for the `%` operator is 0.3; 0.2 is deliberately a bit more permissive so short names
// and minor typos still surface — tune based on observed result quality, not guesswork).
const TRIGRAM_THRESHOLD = 0.2;

/**
 * Explainable people search: every result carries the concrete reasons it matched
 * (skillMatch / geoMatch / hasPortfolio / availability) instead of a single blended
 * trust/relevance score — the plan explicitly forbids an opaque single score (section 2.12).
 * Secondary skills are searched exactly like primary skills, just labeled differently in
 * the result (section 2.3: secondary skills must be fully searchable).
 *
 * Ranking (docs/roadmap/01-search-and-discovery.md): when a text query is present,
 * candidates are selected and ordered using a blend of Postgres full-text rank
 * (`ts_rank` against the generated `PersonProfile.searchVector`) and trigram similarity
 * (`pg_trgm`) across displayName/bio/skill name/skill alias — not `updatedAt desc`.
 * Browsing without a text query (filters only) still orders by `updatedAt desc`, since
 * there is nothing to rank relevance against.
 *
 * Two flagged policy decisions (see docs/decisions.md for the full entry):
 * - Unapproved/pending skills (`Skill.isApproved: false`) never surface a profile via
 *   skill-name/alias text matching here, matching the existing skill picker's behavior.
 * - `PortfolioItem.visibility` gates the `hasPortfolio`/`portfolioCount` signal to
 *   `PUBLIC` items only, matching what `getProfileBySlug()` actually renders on the
 *   profile page itself (see `profile-service.ts`) — search's evidence signal can't
 *   count evidence a searcher wouldn't actually be able to see on the profile.
 */
export async function searchPeople(input: SearchPeopleInput): Promise<SearchPeopleResult> {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(input.offset ?? 0, 0);
  const trimmedQuery = input.query?.trim() || undefined;

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

  const { profiles, total } = trimmedQuery
    ? await rankedQueryFind({ input, geoFilter, trimmedQuery, limit, offset })
    : await plainFilterFind({ input, geoFilter, limit, offset });

  const results = profiles.map((profile) => buildResult(profile, input, geoFilter));

  return {
    results,
    total,
    limit,
    offset,
    hasMore: offset + profiles.length < total,
  };
}

type ProfileWithSkills = Awaited<ReturnType<typeof fetchProfilesByIds>>[number];

async function fetchProfilesByIds(ids: string[]) {
  return prisma.personProfile.findMany({
    where: { id: { in: ids } },
    include: {
      personSkills: { include: { skill: true } },
      _count: { select: { portfolioItems: { where: { visibility: "PUBLIC" } } } },
    },
  });
}

/** No text query: plain typed Prisma query, ordered by recency, same as pre-ranking behavior. */
async function plainFilterFind(params: {
  input: SearchPeopleInput;
  geoFilter: { city?: string; region?: string; country?: string } | null;
  limit: number;
  offset: number;
}) {
  const { input, geoFilter, limit, offset } = params;

  const where = {
    user: { status: "ACTIVE" as const },
    ...(input.availability ? { availability: input.availability } : {}),
    ...(geoFilter?.city ? { city: geoFilter.city } : {}),
    ...(geoFilter?.region ? { region: geoFilter.region } : {}),
    ...(geoFilter?.country && !geoFilter.city ? { country: geoFilter.country } : {}),
    ...(input.skillId ? { personSkills: { some: { skillId: input.skillId } } } : {}),
    ...(input.stage ? { personSkills: { some: { stage: input.stage } } } : {}),
  };

  const [profiles, total] = await Promise.all([
    prisma.personProfile.findMany({
      where,
      include: {
        personSkills: { include: { skill: true } },
        _count: { select: { portfolioItems: { where: { visibility: "PUBLIC" } } } },
      },
      take: limit,
      skip: offset,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.personProfile.count({ where }),
  ]);

  return { profiles, total };
}

/** Text query present: rank candidates with ts_rank + trigram similarity via raw SQL,
 * then re-fetch the typed rows for that page so the rest of the mapping code stays
 * identical to the no-query path. */
async function rankedQueryFind(params: {
  input: SearchPeopleInput;
  geoFilter: { city?: string; region?: string; country?: string } | null;
  trimmedQuery: string;
  limit: number;
  offset: number;
}) {
  const { input, geoFilter, trimmedQuery, limit, offset } = params;
  const likeTerm = `%${trimmedQuery}%`;

  const conditions: Prisma.Sql[] = [Prisma.sql`u."status" = 'ACTIVE'`];
  if (input.availability) {
    conditions.push(Prisma.sql`pp."availability" = ${input.availability}::"AvailabilityStatus"`);
  }
  if (geoFilter?.city) conditions.push(Prisma.sql`pp."city" = ${geoFilter.city}`);
  if (geoFilter?.region) conditions.push(Prisma.sql`pp."region" = ${geoFilter.region}`);
  if (geoFilter?.country && !geoFilter.city) {
    conditions.push(Prisma.sql`pp."country" = ${geoFilter.country}`);
  }
  if (input.skillId) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "PersonSkill" ps WHERE ps."personProfileId" = pp.id AND ps."skillId" = ${input.skillId})`,
    );
  }
  if (input.stage) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "PersonSkill" ps WHERE ps."personProfileId" = pp.id AND ps."stage" = ${input.stage}::"ProfessionalStage")`,
    );
  }

  // Flagged policy decision: unapproved/pending skills never surface a profile through
  // skill name/alias text matching (approved-only), matching the skill picker's
  // existing behavior. See docs/decisions.md.
  conditions.push(Prisma.sql`(
    pp."displayName" ILIKE ${likeTerm} OR
    pp."bio" ILIKE ${likeTerm} OR
    pp."searchVector" @@ websearch_to_tsquery('english', ${trimmedQuery}) OR
    similarity(pp."displayName", ${trimmedQuery}) > ${TRIGRAM_THRESHOLD} OR
    similarity(coalesce(pp."bio", ''), ${trimmedQuery}) > ${TRIGRAM_THRESHOLD} OR
    EXISTS (
      SELECT 1 FROM "PersonSkill" ps
      JOIN "Skill" s ON s.id = ps."skillId"
      WHERE ps."personProfileId" = pp.id AND s."isApproved" = true AND (
        s."name" ILIKE ${likeTerm} OR
        similarity(s."name", ${trimmedQuery}) > ${TRIGRAM_THRESHOLD} OR
        EXISTS (
          SELECT 1 FROM "SkillAlias" sa
          WHERE sa."skillId" = s.id AND (
            sa."alias" ILIKE ${likeTerm} OR similarity(sa."alias", ${trimmedQuery}) > ${TRIGRAM_THRESHOLD}
          )
        )
      )
    )
  )`);

  const whereSql = Prisma.join(conditions, " AND ");

  // Relevance blend (not a single opaque trust score — this ordering sits entirely
  // behind the explainable `matchReasons` breakdown computed afterward, and only ever
  // changes result order, never which signals are shown):
  //   full-text rank (searchVector)  weight 3.0
  //   displayName trigram similarity weight 2.0
  //   bio trigram similarity         weight 1.0
  //   best matching skill/alias sim  weight 2.5
  const rankSql = Prisma.sql`
    (
      (CASE WHEN pp."searchVector" @@ websearch_to_tsquery('english', ${trimmedQuery})
            THEN ts_rank(pp."searchVector", websearch_to_tsquery('english', ${trimmedQuery}))
            ELSE 0 END) * 3.0
      + GREATEST(similarity(pp."displayName", ${trimmedQuery}), 0) * 2.0
      + GREATEST(similarity(coalesce(pp."bio", ''), ${trimmedQuery}), 0) * 1.0
      + COALESCE((
          SELECT MAX(sim) FROM (
            SELECT similarity(s."name", ${trimmedQuery}) AS sim
            FROM "PersonSkill" ps
            JOIN "Skill" s ON s.id = ps."skillId"
            WHERE ps."personProfileId" = pp.id AND s."isApproved" = true
            UNION ALL
            SELECT similarity(sa."alias", ${trimmedQuery}) AS sim
            FROM "PersonSkill" ps
            JOIN "Skill" s ON s.id = ps."skillId"
            JOIN "SkillAlias" sa ON sa."skillId" = s.id
            WHERE ps."personProfileId" = pp.id AND s."isApproved" = true
          ) skill_sims
        ), 0) * 2.5
    )
  `;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT pp.id
      FROM "PersonProfile" pp
      JOIN "User" u ON u.id = pp."userId"
      WHERE ${whereSql}
      ORDER BY ${rankSql} DESC, pp."updatedAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "PersonProfile" pp
      JOIN "User" u ON u.id = pp."userId"
      WHERE ${whereSql}
    `),
  ]);

  const orderedIds = rows.map((r) => r.id);
  const total = Number(countRows[0]?.count ?? 0);

  if (orderedIds.length === 0) return { profiles: [], total };

  const unordered = await fetchProfilesByIds(orderedIds);
  const byId = new Map(unordered.map((p) => [p.id, p]));
  const profiles = orderedIds.map((id) => byId.get(id)).filter((p): p is ProfileWithSkills => Boolean(p));

  return { profiles, total };
}

function buildResult(
  profile: ProfileWithSkills,
  input: SearchPeopleInput,
  geoFilter: { city?: string; region?: string; country?: string } | null,
): SearchPersonResult {
  const primary = profile.personSkills.find((ps) => ps.isPrimary);
  let matched = input.skillId
    ? profile.personSkills.find((ps) => ps.skillId === input.skillId)
    : profile.personSkills.find(
        (ps) =>
          input.query &&
          ps.skill.isApproved &&
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
}

/**
 * Skill picker: trigram-ranked instead of alphabetical, so close/typo'd matches float
 * to the top instead of being ordered A-Z. Stays `isApproved: true`-only, unchanged.
 */
export async function searchSkillsForPicker(query: string): Promise<Array<{ id: string; name: string }>> {
  const trimmed = query.trim();
  if (!trimmed) {
    return prisma.skill.findMany({
      where: { isApproved: true },
      select: { id: true, name: true },
      take: 20,
      orderBy: { name: "asc" },
    });
  }

  const likeTerm = `%${trimmed}%`;
  const rows = await prisma.$queryRaw<Array<{ id: string; name: string }>>(Prisma.sql`
    SELECT s.id, s.name
    FROM "Skill" s
    WHERE s."isApproved" = true AND (
      s."name" ILIKE ${likeTerm} OR
      similarity(s."name", ${trimmed}) > ${TRIGRAM_THRESHOLD} OR
      EXISTS (
        SELECT 1 FROM "SkillAlias" sa
        WHERE sa."skillId" = s.id AND (sa."alias" ILIKE ${likeTerm} OR similarity(sa."alias", ${trimmed}) > ${TRIGRAM_THRESHOLD})
      )
    )
    ORDER BY GREATEST(
      similarity(s."name", ${trimmed}),
      COALESCE((SELECT MAX(similarity(sa."alias", ${trimmed})) FROM "SkillAlias" sa WHERE sa."skillId" = s.id), 0)
    ) DESC, s."name" ASC
    LIMIT 20
  `);
  return rows;
}
