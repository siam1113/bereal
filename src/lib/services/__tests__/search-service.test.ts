import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { searchPeople, searchSkillsForPicker } from "@/lib/services/search-service";

/**
 * Covers the Track 1 (search & discovery) invariants from
 * docs/roadmap/01-search-and-discovery.md: secondary skills are fully searchable (not
 * just primary), ranking reorders results without collapsing `matchReasons` into a
 * single score, typo-tolerant trigram matching actually works, pagination is real, and
 * the two flagged policy decisions (unapproved skills never surface via text match,
 * PortfolioItem.visibility gates the evidence count) hold. Runs against a real local
 * Postgres (see docs/testing.md) using throwaway rows this file creates and tears down.
 */

const RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeProfile(opts: {
  label: string;
  displayName: string;
  bio?: string;
  city?: string;
  region?: string;
  country?: string;
}) {
  const user = await prisma.user.create({
    data: {
      email: `${opts.label}.${RUN_ID}@test.invalid`,
      name: opts.displayName,
      status: "ACTIVE",
    },
  });
  const profile = await prisma.personProfile.create({
    data: {
      userId: user.id,
      slug: `${opts.label}-${RUN_ID}`,
      displayName: opts.displayName,
      bio: opts.bio,
      city: opts.city,
      region: opts.region,
      country: opts.country,
    },
  });
  return { user, profile };
}

describe("search-service", () => {
  let approvedSkillId: string;
  let unapprovedSkillId: string;
  let carpenterProfileId: string;

  beforeAll(async () => {
    const approved = await prisma.skill.create({
      data: { slug: `carpentry-${RUN_ID}`, name: `Carpentry ${RUN_ID}`, categoryGroup: "TRADES" },
    });
    approvedSkillId = approved.id;

    const unapproved = await prisma.skill.create({
      data: {
        slug: `pending-skill-${RUN_ID}`,
        name: `Zyxqlonium ${RUN_ID}`,
        categoryGroup: "OTHER",
        isApproved: false,
      },
    });
    unapprovedSkillId = unapproved.id;

    // Primary subject: carpenter, secondary skill is the approved one above, has one
    // PUBLIC and one PRIVATE portfolio item.
    const { profile } = await makeProfile({
      label: "carpenter",
      displayName: `Wendell Carpenter ${RUN_ID}`,
      bio: "Builds custom furniture",
      city: `Rivertown-${RUN_ID}`,
    });
    carpenterProfileId = profile.id;

    await prisma.personSkill.create({
      data: { personProfileId: profile.id, skillId: approvedSkillId, isPrimary: false, stage: "PRACTICING" },
    });

    await prisma.portfolioItem.create({
      data: { personProfileId: profile.id, title: `Public piece ${RUN_ID}`, visibility: "PUBLIC" },
    });
    await prisma.portfolioItem.create({
      data: { personProfileId: profile.id, title: `Private piece ${RUN_ID}`, visibility: "PRIVATE" },
    });

    // A second profile that only matches via the unapproved skill's name — should never
    // surface from a text search for that skill name.
    const pendingOnly = await makeProfile({
      label: "pendingonly",
      displayName: `Someone Else ${RUN_ID}`,
      bio: "No relation to the query text at all",
    });
    await prisma.personSkill.create({
      data: { personProfileId: pendingOnly.profile.id, skillId: unapprovedSkillId, isPrimary: true },
    });

    // Enough extra profiles to exercise pagination (3 total matches for a shared term).
    await makeProfile({ label: "pager-a", displayName: `Paginator Alpha ${RUN_ID}`, bio: "shared-term-x" });
    await makeProfile({ label: "pager-b", displayName: `Paginator Beta ${RUN_ID}`, bio: "shared-term-x" });
    await makeProfile({ label: "pager-c", displayName: `Paginator Gamma ${RUN_ID}`, bio: "shared-term-x" });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
    await prisma.skill.deleteMany({ where: { slug: { contains: RUN_ID } } });
  });

  it("finds a profile via a secondary (non-primary) skill match", async () => {
    const { results } = await searchPeople({ query: `Carpentry ${RUN_ID}` });
    const hit = results.find((r) => r.profileId === carpenterProfileId);
    expect(hit).toBeDefined();
    expect(hit!.matchReasons.skillMatch).toBe("secondary");
  });

  it("keeps the explainable matchReasons breakdown instead of a single score", async () => {
    const { results } = await searchPeople({ query: `Wendell ${RUN_ID}` });
    const hit = results.find((r) => r.profileId === carpenterProfileId);
    expect(hit).toBeDefined();
    expect(hit!.matchReasons).toEqual(
      expect.objectContaining({
        skillMatch: expect.any(String),
        geoMatch: expect.any(String),
        hasPortfolio: expect.any(Boolean),
        availability: expect.any(String),
      }),
    );
    // No blended score field anywhere on the result.
    expect(hit).not.toHaveProperty("score");
    expect(hit).not.toHaveProperty("rank");
  });

  it("is typo-tolerant via trigram similarity", async () => {
    // "Wendll" (missing an 'e') shouldn't match a plain ILIKE/contains, but should
    // match via trigram similarity.
    const { results } = await searchPeople({ query: `Wendll Carpentr ${RUN_ID}` });
    expect(results.some((r) => r.profileId === carpenterProfileId)).toBe(true);
  });

  it("never surfaces a profile via an unapproved/pending skill's name", async () => {
    // Deliberately query the nonce word alone, without the RUN_ID suffix: RUN_ID is
    // appended to every fixture's name/bio in this file for isolation, so a query
    // containing it would itself trigram-match every other fixture row (they all
    // share that substring) regardless of the unapproved-skill gating this test is
    // actually trying to verify.
    const { results } = await searchPeople({ query: "Zyxqlonium" });
    expect(results).toHaveLength(0);
  });

  it("only counts PUBLIC portfolio items toward the portfolio evidence signal", async () => {
    const { results } = await searchPeople({ query: `Wendell ${RUN_ID}` });
    const hit = results.find((r) => r.profileId === carpenterProfileId);
    expect(hit).toBeDefined();
    expect(hit!.portfolioCount).toBe(1);
    expect(hit!.matchReasons.hasPortfolio).toBe(true);
  });

  it("paginates with a real limit/offset and reports total/hasMore", async () => {
    // bio contains the plain term "shared-term-x" (no run id) on 3 throwaway profiles
    // created in beforeAll; run-scoped isolation doesn't matter here since the
    // assertions are relative (>=3, no overlap), not exact counts.
    const page1 = await searchPeople({ query: "shared-term-x", limit: 2, offset: 0 });
    expect(page1.results.length).toBeLessThanOrEqual(2);
    expect(page1.total).toBeGreaterThanOrEqual(3);
    expect(page1.hasMore).toBe(true);

    const page2 = await searchPeople({ query: "shared-term-x", limit: 2, offset: 2 });
    const page1Ids = new Set(page1.results.map((r) => r.profileId));
    const page2Ids = new Set(page2.results.map((r) => r.profileId));
    for (const id of page2Ids) expect(page1Ids.has(id)).toBe(false);
  });

  it("falls back to recency ordering (no raw-SQL path) when there is no text query", async () => {
    const { results, total } = await searchPeople({ availability: "NOT_AVAILABLE", limit: 1 });
    expect(total).toBeGreaterThan(0);
    expect(results.length).toBe(1);
  });

  it("excludes unapproved skills from the skill picker", async () => {
    // Same reasoning as above: query the nonce word alone so trigram similarity isn't
    // dominated by the shared RUN_ID substring every fixture in this file carries.
    const options = await searchSkillsForPicker("Zyxqlonium");
    expect(options).toHaveLength(0);
  });

  it("ranks the skill picker with trigram similarity for a typo", async () => {
    const options = await searchSkillsForPicker(`Carpentr ${RUN_ID}`);
    expect(options.some((s) => s.id === approvedSkillId)).toBe(true);
  });

  it("never exposes a precise location field on results", async () => {
    const { results } = await searchPeople({ query: `Wendell ${RUN_ID}` });
    const hit = results.find((r) => r.profileId === carpenterProfileId);
    expect(hit).toBeDefined();
    expect(hit).not.toHaveProperty("approxLat");
    expect(hit).not.toHaveProperty("approxLng");
    expect(hit).not.toHaveProperty("address");
  });
});
