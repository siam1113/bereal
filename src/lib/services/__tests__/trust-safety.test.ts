import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { raiseDispute } from "@/lib/services/relationship-service";
import { resolveDispute } from "@/lib/services/admin-dispute-service";
import { submitClaim } from "@/lib/services/claim-service";
import { decideClaim } from "@/lib/services/admin-claim-review-service";
import { createEndorsement } from "@/lib/services/endorsement-service";
import {
  assignReviewCase,
  decideVerificationTier,
  getReviewCaseFor,
  openReviewCase,
} from "@/lib/services/review-case-service";
import { createFlag, dismissFlag, escalateFlag, listFlags } from "@/lib/services/moderation-flag-service";
import { detectEndorsementRings } from "@/lib/services/abuse-detection-service";
import { getSafetyMetricsSummary } from "@/lib/services/safety-metrics-service";

/**
 * Covers Track 9's queue/workflow primitives (see
 * docs/roadmap/09-trust-safety-and-moderation.md and the `ReviewCase`/
 * `ModerationFlag`/`SafetyMetricEvent` doc comments in prisma/schema.prisma):
 *
 *   1. Raising a relationship dispute opens a generic ReviewCase; resolving it
 *      closes that case and records a resolution-time metric.
 *   2. Submitting a claim opens a tiered verification ReviewCase; a terminal
 *      decision closes it, REQUEST_MORE_INFO does not.
 *   3. openReviewCase is idempotent per (caseType, entityType, entityId) — no
 *      duplicate queue entries for the same substantive record.
 *   4. ModerationFlag triage: escalating opens an ABUSE_FLAG ReviewCase; dismissing
 *      does not. Nothing here auto-actions against a user — every transition is an
 *      explicit admin call.
 *   5. The endorsement-ring detector flags a reciprocal, evidence-less pair and is
 *      idempotent across repeated scans; it does not flag a reciprocal pair that
 *      has independent evidence attached.
 *
 * Runs against a real local Postgres (see docs/testing.md) using throwaway users
 * this file creates and tears down itself.
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

describe("trust & safety queue/workflow primitives", () => {
  let userA: { id: string };
  let userB: { id: string };
  let userC: { id: string };
  let userD: { id: string };
  let admin: { id: string };
  let skillId: string;

  // ReviewCase/ModerationFlag/SafetyMetricEvent point at users and at each other via
  // free-text (entityType, entityId) pairs rather than cascading FKs (see the
  // ReviewCase doc comment in prisma/schema.prisma) — deleting the test users below
  // won't cascade-clean these, so every row this file creates (directly or via a
  // service call) gets its id recorded here for explicit teardown.
  const reviewCaseIds: string[] = [];
  const flagIds: string[] = [];
  const metricEntityIds: string[] = [];

  async function trackCase(caseType: "DISPUTE" | "VERIFICATION" | "ABUSE_FLAG", entityType: string, entityId: string) {
    const found = await getReviewCaseFor(caseType, entityType, entityId);
    if (found) reviewCaseIds.push(found.id);
    return found;
  }

  beforeAll(async () => {
    userA = await makeUser("usera");
    userB = await makeUser("userb");
    userC = await makeUser("userc");
    userD = await makeUser("userd");
    admin = await makeUser("admin");
    const skill = await prisma.skill.create({
      data: { slug: `test-skill-${RUN_ID}`, name: `Test skill ${RUN_ID}`, categoryGroup: "OTHER" },
    });
    skillId = skill.id;
  });

  afterAll(async () => {
    const userIds = [userA.id, userB.id, userC.id, userD.id, admin.id];
    await prisma.safetyMetricEvent.deleteMany({
      where: { OR: [{ actorUserId: { in: userIds } }, { entityId: { in: metricEntityIds } }] },
    });
    await prisma.reviewCase.deleteMany({ where: { id: { in: reviewCaseIds } } });
    await prisma.moderationFlag.deleteMany({ where: { id: { in: flagIds } } });
    // Pre-existing gap outside this track's scope: RelationshipDispute.relationship
    // and RelationshipEvidence.relationship both cascade on delete, but
    // RelationshipDispute.raisedBy / RelationshipEvidence.addedBy do not (see
    // prisma/schema.prisma) — deleting a user who raised a dispute or added
    // evidence fails on those FKs unless those rows go first. Scoped to this test's
    // own data.
    await prisma.relationshipDispute.deleteMany({ where: { raisedByUserId: { in: userIds } } });
    await prisma.relationshipEvidence.deleteMany({ where: { addedByUserId: { in: userIds } } });
    // Same gap, VerificationReview.reviewer (admin's decideClaim call creates one).
    await prisma.verificationReview.deleteMany({ where: { reviewerUserId: { in: userIds } } });
    // User delete cascades to relationships/endorsements/etc (schema onDelete: Cascade).
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
    await prisma.skill.deleteMany({ where: { slug: { contains: RUN_ID } } });
  });

  it("opens a DISPUTE review case when a relationship dispute is raised, and closes it on resolution", async () => {
    const relationship = await prisma.relationship.create({
      data: {
        type: "WORKED_WITH",
        partyAUserId: userA.id,
        partyARole: "WORKED_WITH",
        partyBUserId: userB.id,
        partyBRole: "WORKED_WITH",
        declaredByUserId: userA.id,
      },
    });

    const dispute = await raiseDispute(relationship.id, userB.id, "Never actually worked together");
    metricEntityIds.push(dispute.id);

    const openedCase = await trackCase("DISPUTE", "RELATIONSHIP_DISPUTE", dispute.id);
    expect(openedCase).not.toBeNull();
    expect(openedCase!.status).toBe("OPEN");
    expect(openedCase!.subjectUserId).toBe(userA.id); // the counterpart to whoever raised it

    await resolveDispute(dispute.id, "RESOLVED_UPHELD", "confirmed via admin review", admin.id);

    const closedCase = await getReviewCaseFor("DISPUTE", "RELATIONSHIP_DISPUTE", dispute.id);
    expect(closedCase!.status).toBe("RESOLVED");
    expect(closedCase!.outcome).toBe("RESOLVED_UPHELD");
    expect(closedCase!.resolvedAt).not.toBeNull();
  });

  it("is idempotent: opening a review case twice for the same entity returns the same row", async () => {
    const first = await openReviewCase({
      caseType: "ABUSE_FLAG",
      entityType: "MODERATION_FLAG",
      entityId: `dedupe-${RUN_ID}`,
    });
    const second = await openReviewCase({
      caseType: "ABUSE_FLAG",
      entityType: "MODERATION_FLAG",
      entityId: `dedupe-${RUN_ID}`,
    });
    expect(second.id).toBe(first.id);
    reviewCaseIds.push(first.id);
  });

  it("assigning a review case stamps firstActionAt and status ASSIGNED", async () => {
    const reviewCase = await openReviewCase({
      caseType: "VERIFICATION",
      entityType: "CREDENTIAL_CLAIM",
      entityId: `assign-${RUN_ID}`,
    });
    const assigned = await assignReviewCase(reviewCase.id, admin.id, admin.id);
    expect(assigned.status).toBe("ASSIGNED");
    expect(assigned.assignedToUserId).toBe(admin.id);
    expect(assigned.firstActionAt).not.toBeNull();
    // assigned.assignedToUserId is a real FK to `admin` — must be torn down before
    // the user delete in afterAll, or that delete fails with an FK violation.
    reviewCaseIds.push(reviewCase.id);
  });

  it("routes a tiered verification claim to a ReviewCase, closing it only on a terminal decision", async () => {
    const claim = await submitClaim({
      subjectUserId: userA.id,
      claimType: "CREDENTIAL",
      title: "Licensed electrician",
      evidenceUrls: [],
    });

    // No evidence attached to an IDENTITY/CREDENTIAL claim -> deep review, per the
    // placeholder heuristic in review-case-service.ts.
    expect(decideVerificationTier({ claimType: "CREDENTIAL", evidenceUrlCount: 0 })).toBe("DEEP_REVIEW");

    const opened = await getReviewCaseFor("VERIFICATION", "CREDENTIAL_CLAIM", claim.id);
    expect(opened).not.toBeNull();
    expect(opened!.tier).toBe("DEEP_REVIEW");
    expect(opened!.status).toBe("OPEN");
    // opened.subjectUserId is a real FK to userA — track for pre-teardown deletion.
    reviewCaseIds.push(opened!.id);

    await decideClaim(claim.id, admin.id, "REQUEST_MORE_INFO", "need more docs");
    const stillOpen = await getReviewCaseFor("VERIFICATION", "CREDENTIAL_CLAIM", claim.id);
    expect(stillOpen!.status).toBe("OPEN");

    await decideClaim(claim.id, admin.id, "APPROVED", "looks good");
    const closed = await getReviewCaseFor("VERIFICATION", "CREDENTIAL_CLAIM", claim.id);
    expect(closed!.status).toBe("RESOLVED");
    expect(closed!.outcome).toBe("APPROVED");
  });

  it("escalating a moderation flag opens an ABUSE_FLAG review case; dismissing does not", async () => {
    const flag = await createFlag({
      entityType: "USER",
      entityId: userA.id,
      subjectUserId: userA.id,
      patternType: `TEST_PATTERN_${RUN_ID}`,
      detectorId: `manual-test@${RUN_ID}`,
      evidence: { note: "synthetic flag for test" },
    });

    const dismissed = await dismissFlag(flag.id, admin.id, "false positive");
    expect(dismissed.status).toBe("DISMISSED");
    const noCase = await getReviewCaseFor("ABUSE_FLAG", "MODERATION_FLAG", flag.id);
    expect(noCase).toBeNull();
    // flag.subjectUserId (userA) and flag.reviewedByUserId (admin, set by dismissFlag)
    // are both real FKs — track before teardown deletes those users.
    flagIds.push(flag.id);

    const flag2 = await createFlag({
      entityType: "USER",
      entityId: userB.id,
      subjectUserId: userB.id,
      patternType: `TEST_PATTERN_${RUN_ID}`,
      detectorId: `manual-test@${RUN_ID}`,
      evidence: { note: "synthetic flag for test" },
    });
    const { reviewCase } = await escalateFlag(flag2.id, admin.id);
    expect(reviewCase.caseType).toBe("ABUSE_FLAG");
    expect(reviewCase.entityId).toBe(flag2.id);
    // flag2.subjectUserId/reviewedByUserId (userB/admin) and reviewCase.subjectUserId
    // (userB, inherited from the flag) are all real FKs — same reasoning as above.
    flagIds.push(flag2.id);
    reviewCaseIds.push(reviewCase.id);

    const flags = await listFlags(["ESCALATED"]);
    expect(flags.some((f) => f.id === flag2.id)).toBe(true);
  });

  it("flags a reciprocal, evidence-less endorsement pair and is idempotent across scans", async () => {
    const relAB = await prisma.relationship.create({
      data: {
        type: "COLLEAGUE",
        partyAUserId: userA.id,
        partyARole: "COLLEAGUE",
        partyBUserId: userB.id,
        partyBRole: "COLLEAGUE",
        declaredByUserId: userA.id,
      },
    });

    await createEndorsement({ endorserUserId: userA.id, subjectUserId: userB.id, skillId, relationshipId: relAB.id });
    const skill2 = await prisma.skill.create({
      data: { slug: `test-skill-2-${RUN_ID}`, name: `Test skill 2 ${RUN_ID}`, categoryGroup: "OTHER" },
    });
    await createEndorsement({ endorserUserId: userB.id, subjectUserId: userA.id, skillId: skill2.id, relationshipId: relAB.id });

    const firstScan = await detectEndorsementRings();
    expect(firstScan.flagged).toBeGreaterThanOrEqual(1);

    const pairKey = [userA.id, userB.id].sort().join(":");
    const flags = await prisma.moderationFlag.findMany({
      where: { entityType: "ENDORSEMENT_CLUSTER", entityId: pairKey },
    });
    expect(flags.length).toBe(1);
    expect(flags[0].patternType).toBe("RECIPROCAL_ENDORSEMENT_NO_EVIDENCE");
    flagIds.push(flags[0].id);

    // Re-running the scan must not create a duplicate flag for the same pair.
    await detectEndorsementRings();
    const flagsAfterRescan = await prisma.moderationFlag.findMany({
      where: { entityType: "ENDORSEMENT_CLUSTER", entityId: pairKey },
    });
    expect(flagsAfterRescan.length).toBe(1);
  });

  it("does not flag a reciprocal pair once independent evidence is attached", async () => {
    const relCD = await prisma.relationship.create({
      data: {
        type: "COLLABORATOR",
        partyAUserId: userC.id,
        partyARole: "COLLABORATOR",
        partyBUserId: userD.id,
        partyBRole: "COLLABORATOR",
        declaredByUserId: userC.id,
      },
    });
    const skill3 = await prisma.skill.create({
      data: { slug: `test-skill-3-${RUN_ID}`, name: `Test skill 3 ${RUN_ID}`, categoryGroup: "OTHER" },
    });
    const skill4 = await prisma.skill.create({
      data: { slug: `test-skill-4-${RUN_ID}`, name: `Test skill 4 ${RUN_ID}`, categoryGroup: "OTHER" },
    });
    await createEndorsement({ endorserUserId: userC.id, subjectUserId: userD.id, skillId: skill3.id, relationshipId: relCD.id });
    await createEndorsement({ endorserUserId: userD.id, subjectUserId: userC.id, skillId: skill4.id, relationshipId: relCD.id });
    await prisma.relationshipEvidence.create({
      data: { relationshipId: relCD.id, description: "Shared project link", addedByUserId: userC.id },
    });

    await detectEndorsementRings();

    const pairKeyCD = [userC.id, userD.id].sort().join(":");
    const flags = await prisma.moderationFlag.findMany({ where: { entityType: "ENDORSEMENT_CLUSTER", entityId: pairKeyCD } });
    expect(flags.length).toBe(0);
  });

  it("computes a safety metrics summary without throwing", async () => {
    const summary = await getSafetyMetricsSummary(30);
    expect(summary.windowDays).toBe(30);
    expect(summary.disputeResolutionTime.resolvedCount).toBeGreaterThanOrEqual(1);
    expect(summary.falseVerificationRate.value).toBeNull();
  });
});
