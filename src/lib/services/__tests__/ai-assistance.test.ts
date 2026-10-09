import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseSearchQuery } from "@/lib/services/ai-query-parser-service";
import { explainMatch } from "@/lib/services/ai-explain-service";
import { draftBioText, draftPortfolioDescription } from "@/lib/services/ai-draft-service";
import { translateText } from "@/lib/services/ai-translation-service";
import { runFraudSignalScan } from "@/lib/services/ai-fraud-signal-service";
import { listAiFlags, resolveAiFlag } from "@/lib/services/admin-ai-flag-service";
import type { SearchPersonResult } from "@/lib/services/search-service";

/**
 * Covers Track 8 (AI assistance)'s core invariants (see
 * docs/roadmap/08-ai-assistance.md and docs/decisions.md):
 *
 * 1. With AI_EXTERNAL_PROVIDER_ENABLED unset/false (the default — see .env and
 *    src/lib/ai-provider.ts), every service runs its local/deterministic fallback and
 *    never needs network access. This suite deliberately runs with the flag off, same
 *    as a real deployment until that policy question is explicitly signed off.
 * 2. Fraud-detection assistance only ever creates PENDING AiModerationFlag rows for a
 *    human to review — it never mutates, auto-rejects, or auto-confirms the
 *    claim/endorsement/relationship rows it scans, and never double-flags the same
 *    target+reason on a second scan.
 * 3. Admin review of a flag is a distinct, explicit action (resolveAiFlag) — a flag
 *    stays PENDING until an admin calls it, and every explanation/evidenceRefs is
 *    traceable back to real row ids, not fabricated.
 *
 * Runs against a real local Postgres (see docs/testing.md) using throwaway users/
 * skills this file creates and tears down itself.
 */

const RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${label}.${RUN_ID}@test.invalid`,
      name: `${label} ${RUN_ID}`,
      status: "ACTIVE",
    },
  });
}

describe("AI assistance (Track 8) invariants", () => {
  let skillId: string;
  let skillName: string;

  // Collected across the fraud-signal tests below so afterAll can clean up precisely
  // without guessing at ids.
  const flagTargetIds: string[] = [];
  const endorsementIds: string[] = [];
  const relationshipIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    const skill = await prisma.skill.create({
      data: {
        slug: `test-skill-${RUN_ID}`,
        name: `Cabinet refinishing ${RUN_ID}`,
        categoryGroup: "TRADES",
        aliases: { create: [{ alias: `cabinet work ${RUN_ID}` }] },
      },
    });
    skillId = skill.id;
    skillName = skill.name;
  });

  afterAll(async () => {
    // Order matters: AiModerationFlag/AuditEvent aren't FK-linked to the rows below, so
    // they're safe to delete any time. Endorsements must go before Relationships
    // (Endorsement.relationshipId is ON DELETE RESTRICT); Relationships must go before
    // Users (Relationship.declaredByUserId is ON DELETE RESTRICT).
    await prisma.aiModerationFlag.deleteMany({ where: { targetId: { in: flagTargetIds } } });
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.endorsement.deleteMany({ where: { id: { in: endorsementIds } } });
    await prisma.relationship.deleteMany({ where: { id: { in: relationshipIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
    await prisma.skill.deleteMany({ where: { slug: { contains: RUN_ID } } });
  });

  describe("NL query parsing (local heuristic, no network by default)", () => {
    it("maps urgency/locality phrases and a real skill name to structured search params", async () => {
      const parsed = await parseSearchQuery(
        `need someone to help with ${skillName} locally this week`,
      );

      expect(parsed.source).toBe("LOCAL_HEURISTIC");
      expect(parsed.geoScope).toBe("LOCAL");
      expect(parsed.availability).toBe("OPEN_TO_WORK");
      expect(parsed.skillId).toBe(skillId);
      expect(parsed.matchedSkillName).toBe(skillName);
      // The parse must be legible, never an opaque black box.
      expect(parsed.parseNotes.length).toBeGreaterThan(0);
    });

    it("never fabricates a skill match when the text names no real skill", async () => {
      const parsed = await parseSearchQuery("just saying hello, no specific request here");
      expect(parsed.skillId).toBeUndefined();
      expect(parsed.matchedSkillName).toBeUndefined();
    });
  });

  describe("Match explanations (grounded only in matchReasons, never a free-floating claim)", () => {
    function fakeResult(overrides: Partial<SearchPersonResult["matchReasons"]>): SearchPersonResult {
      return {
        profileId: "fake-profile-id",
        userId: "fake-user-id",
        slug: "fake-slug",
        displayName: "Fake Person",
        bio: null,
        city: null,
        region: null,
        country: null,
        availability: "OPEN_TO_WORK",
        primarySkillName: skillName,
        matchedSkillName: skillName,
        stage: null,
        portfolioCount: 2,
        matchReasons: {
          skillMatch: "primary",
          geoMatch: "local",
          hasPortfolio: true,
          availability: "OPEN_TO_WORK",
          ...overrides,
        },
      };
    }

    it("cites the real portfolio count and skill/geo match reasons, nothing invented", () => {
      const explanation = explainMatch(fakeResult({}));
      expect(explanation.source).toBe("LOCAL_TEMPLATE");
      expect(explanation.reasons.some((r) => r.includes(skillName))).toBe(true);
      expect(explanation.reasons.some((r) => r.includes("2 portfolio items"))).toBe(true);
      expect(explanation.reasons.some((r) => r.toLowerCase().includes("city"))).toBe(true);
    });

    it("omits the portfolio-evidence line when there is no portfolio to cite", () => {
      const explanation = explainMatch(fakeResult({ hasPortfolio: false }));
      expect(explanation.reasons.some((r) => r.toLowerCase().includes("portfolio"))).toBe(false);
    });
  });

  describe("Drafting assistance (local template fallback; never saves anything)", () => {
    it("drafts a portfolio description from only the given title/tags/notes", async () => {
      const draft = await draftPortfolioDescription({
        title: "Refinished a kitchen cabinet set",
        tags: ["woodworking"],
        rawNotes: "Took three days, client supplied the wood.",
      });
      expect(draft.source).toBe("LOCAL_TEMPLATE");
      expect(draft.draftText).toContain("Refinished a kitchen cabinet set");
      expect(draft.draftText).toContain("woodworking");
      expect(draft.disclaimer.length).toBeGreaterThan(0);
    });

    it("drafts a bio from only the given name/skills/notes", async () => {
      const draft = await draftBioText({
        displayName: "Jordan Rivera",
        primarySkillName: skillName,
        secondarySkillNames: [],
      });
      expect(draft.source).toBe("LOCAL_TEMPLATE");
      expect(draft.draftText).toContain(skillName);
    });
  });

  describe("Translation assistance (honest 'unavailable' rather than a fabricated guess)", () => {
    it("reports unavailable, preserves the original text, and never invents a translation", async () => {
      const result = await translateText("Hola, ¿cómo estás?", "en");
      expect(result.available).toBe(false);
      expect(result.source).toBe("UNAVAILABLE");
      expect(result.translatedText).toBeNull();
      expect(result.originalText).toBe("Hola, ¿cómo estás?");
      expect(result.label.length).toBeGreaterThan(0);
    });
  });

  describe("Fraud-detection assistance (flags for human review; never auto-actions)", () => {
    it("flags a rapid claim burst without mutating the underlying claims, and never double-flags it", async () => {
      const subject = await makeUser("burst-subject");
      userIds.push(subject.id);

      const now = Date.now();
      const claims = await Promise.all(
        [0, 1, 2].map((i) =>
          prisma.credentialClaim.create({
            data: {
              subjectUserId: subject.id,
              claimType: "EXPERIENCE",
              title: `Claim ${i} ${RUN_ID}`,
              status: "SUBMITTED",
              submittedAt: new Date(now + i * 1000),
            },
          }),
        ),
      );
      const lastClaimId = claims[claims.length - 1].id;
      flagTargetIds.push(lastClaimId);

      const first = await runFraudSignalScan();
      expect(first.rapidClaimBurstFlags).toBeGreaterThanOrEqual(1);

      const flag = await prisma.aiModerationFlag.findUnique({
        where: {
          targetType_targetId_reasonCode: {
            targetType: "CREDENTIAL_CLAIM",
            targetId: lastClaimId,
            reasonCode: "RAPID_CLAIM_BURST",
          },
        },
      });
      expect(flag).not.toBeNull();
      expect(flag?.status).toBe("PENDING");
      expect((flag?.evidenceRefs as { claimIds: string[] }).claimIds).toEqual(
        claims.map((c) => c.id),
      );

      // Never auto-actions the claims it scanned.
      const stillSubmitted = await prisma.credentialClaim.findMany({
        where: { id: { in: claims.map((c) => c.id) } },
        select: { status: true },
      });
      expect(stillSubmitted.every((c) => c.status === "SUBMITTED")).toBe(true);

      // Running again must not create a duplicate flag for the same target+reason.
      const second = await runFraudSignalScan();
      expect(second.rapidClaimBurstFlags).toBe(0);
      const countAfter = await prisma.aiModerationFlag.count({
        where: { targetType: "CREDENTIAL_CLAIM", targetId: lastClaimId, reasonCode: "RAPID_CLAIM_BURST" },
      });
      expect(countAfter).toBe(1);
    });

    it("flags a reciprocal pair of unverified endorsements as a suspected ring", async () => {
      const userA = await makeUser("ring-a");
      const userB = await makeUser("ring-b");
      userIds.push(userA.id, userB.id);

      const relationship = await prisma.relationship.create({
        data: {
          type: "COLLEAGUE",
          partyAUserId: userA.id,
          partyARole: "Colleague",
          partyBUserId: userB.id,
          partyBRole: "Colleague",
          declaredByUserId: userA.id,
          confirmationStatus: "SELF_DECLARED",
        },
      });
      relationshipIds.push(relationship.id);

      const forward = await prisma.endorsement.create({
        data: {
          endorserUserId: userA.id,
          subjectUserId: userB.id,
          skillId,
          relationshipId: relationship.id,
          status: "UNVERIFIED",
        },
      });
      const reciprocal = await prisma.endorsement.create({
        data: {
          endorserUserId: userB.id,
          subjectUserId: userA.id,
          skillId,
          relationshipId: relationship.id,
          status: "UNVERIFIED",
        },
      });
      endorsementIds.push(forward.id, reciprocal.id);
      flagTargetIds.push(forward.id, reciprocal.id);

      const result = await runFraudSignalScan();
      expect(result.endorsementRingFlags).toBeGreaterThanOrEqual(2);

      const flags = await prisma.aiModerationFlag.findMany({
        where: { targetType: "ENDORSEMENT", targetId: { in: [forward.id, reciprocal.id] } },
      });
      expect(flags).toHaveLength(2);
      expect(flags.every((f) => f.status === "PENDING" && f.reasonCode === "ENDORSEMENT_RING_SUSPECTED")).toBe(
        true,
      );

      // Never auto-actions the endorsements it scanned.
      const stillUnverified = await prisma.endorsement.findMany({
        where: { id: { in: [forward.id, reciprocal.id] } },
        select: { status: true },
      });
      expect(stillUnverified.every((e) => e.status === "UNVERIFIED")).toBe(true);
    });

    it("flags each relationship behind a user's repeated disputed self-declarations", async () => {
      const declarer = await makeUser("repeat-declarer");
      const counterpartOne = await makeUser("repeat-counterpart-1");
      const counterpartTwo = await makeUser("repeat-counterpart-2");
      userIds.push(declarer.id, counterpartOne.id, counterpartTwo.id);

      const relOne = await prisma.relationship.create({
        data: {
          type: "COLLEAGUE",
          partyAUserId: declarer.id,
          partyARole: "Colleague",
          partyBUserId: counterpartOne.id,
          partyBRole: "Colleague",
          declaredByUserId: declarer.id,
          confirmationStatus: "SELF_DECLARED",
        },
      });
      const relTwo = await prisma.relationship.create({
        data: {
          type: "COLLEAGUE",
          partyAUserId: declarer.id,
          partyARole: "Colleague",
          partyBUserId: counterpartTwo.id,
          partyBRole: "Colleague",
          declaredByUserId: declarer.id,
          confirmationStatus: "SELF_DECLARED",
        },
      });
      relationshipIds.push(relOne.id, relTwo.id);
      flagTargetIds.push(relOne.id, relTwo.id);

      await prisma.relationshipDispute.create({
        data: { relationshipId: relOne.id, raisedByUserId: counterpartOne.id, reason: "Never worked together", status: "OPEN" },
      });
      await prisma.relationshipDispute.create({
        data: { relationshipId: relTwo.id, raisedByUserId: counterpartTwo.id, reason: "Don't know this person", status: "OPEN" },
      });

      const result = await runFraudSignalScan();
      expect(result.repeatedDisputeFlags).toBeGreaterThanOrEqual(2);

      const flags = await prisma.aiModerationFlag.findMany({
        where: { targetType: "RELATIONSHIP", targetId: { in: [relOne.id, relTwo.id] } },
      });
      expect(flags).toHaveLength(2);
      expect(
        flags.every((f) => f.status === "PENDING" && f.reasonCode === "REPEATED_DISPUTED_SELF_DECLARATION"),
      ).toBe(true);
    });

    it("lets an admin resolve a flag, and the resolution is itself audited", async () => {
      const admin = await makeUser("flag-admin");
      userIds.push(admin.id);

      const subject = await makeUser("resolve-subject");
      userIds.push(subject.id);
      const claim = await prisma.credentialClaim.create({
        data: { subjectUserId: subject.id, claimType: "EXPERIENCE", title: `Solo claim ${RUN_ID}`, status: "SUBMITTED" },
      });

      await prisma.aiModerationFlag.create({
        data: {
          targetType: "CREDENTIAL_CLAIM",
          targetId: claim.id,
          reasonCode: "RAPID_CLAIM_BURST",
          explanation: "Test-seeded flag for admin-review coverage.",
          evidenceRefs: { claimIds: [claim.id] },
        },
      });
      flagTargetIds.push(claim.id);

      const pendingBefore = await listAiFlags(["PENDING"]);
      expect(pendingBefore.some((f) => f.targetId === claim.id)).toBe(true);

      const resolved = await resolveAiFlag(
        pendingBefore.find((f) => f.targetId === claim.id)!.id,
        "REVIEWED_DISMISSED",
        "False positive — single legitimate claim.",
        admin.id,
      );
      expect(resolved.status).toBe("REVIEWED_DISMISSED");
      expect(resolved.reviewedByUserId).toBe(admin.id);
      expect(resolved.reviewedAt).not.toBeNull();

      const pendingAfter = await listAiFlags(["PENDING"]);
      expect(pendingAfter.some((f) => f.targetId === claim.id)).toBe(false);

      const auditEntry = await prisma.auditEvent.findFirst({
        where: { actorUserId: admin.id, action: "AI_FLAG_REVIEWED_DISMISSED", targetId: resolved.id },
      });
      expect(auditEntry).not.toBeNull();
    });
  });
});
