import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { recordSafetyMetricEvent } from "@/lib/services/safety-metrics-service";
import type { ReviewCaseStatus, ReviewCaseType, ReviewPriority, ReviewTier } from "@prisma/client";

/**
 * The generic workflow envelope for Track 9 (trust/safety/moderation at scale) —
 * see the block comment above `ReviewCase` in prisma/schema.prisma for the full
 * extensibility contract. This file owns SLA/tier/assignment/status bookkeeping
 * only; the substantive decision (approved/rejected, upheld/removed) always stays
 * on the record being reviewed (`CredentialClaim`, `RelationshipDispute`,
 * `ModerationFlag`, or a future Track 2/3 model) — never duplicated here.
 *
 * SLA-by-tier/priority durations below are placeholders pending a real product/ops
 * decision — see this track's final report. They exist so the SLA-tracking
 * *mechanism* works end-to-end, not because these specific hour counts are policy.
 */

const SLA_HOURS: Record<ReviewCaseType, Record<ReviewPriority, number>> = {
  VERIFICATION: { NORMAL: 72, HIGH: 24, URGENT: 4 },
  DISPUTE: { NORMAL: 120, HIGH: 48, URGENT: 12 },
  ABUSE_FLAG: { NORMAL: 48, HIGH: 24, URGENT: 4 },
};

// Placeholder tiering heuristic for verification review — see "Policy questions to
// flag" in this track's report. Real tiering criteria (which claim types/evidence
// shapes qualify for the quick path) is a product call, not something to invent
// here. This only demonstrates the mechanism: identity/credential claims with no
// evidence attached get routed to deep review; everything else defaults to the
// quick path.
export function decideVerificationTier(input: {
  claimType: string;
  evidenceUrlCount: number;
}): ReviewTier {
  if ((input.claimType === "IDENTITY" || input.claimType === "CREDENTIAL") && input.evidenceUrlCount === 0) {
    return "DEEP_REVIEW";
  }
  return "QUICK_PATH";
}

export async function openReviewCase(input: {
  caseType: ReviewCaseType;
  entityType: string;
  entityId: string;
  subjectUserId?: string;
  tier?: ReviewTier;
  priority?: ReviewPriority;
  actorUserId?: string;
}) {
  const priority = input.priority ?? "NORMAL";
  const slaDueAt = new Date(Date.now() + SLA_HOURS[input.caseType][priority] * 60 * 60 * 1000);

  // One case per substantive record — re-running a detector or re-submitting a
  // dispute against the same row should not fork the queue into duplicates.
  const existing = await prisma.reviewCase.findUnique({
    where: { caseType_entityType_entityId: { caseType: input.caseType, entityType: input.entityType, entityId: input.entityId } },
  });
  if (existing) return existing;

  const reviewCase = await prisma.reviewCase.create({
    data: {
      caseType: input.caseType,
      entityType: input.entityType,
      entityId: input.entityId,
      subjectUserId: input.subjectUserId,
      tier: input.tier,
      priority,
      slaDueAt,
    },
  });

  await logAudit({
    actorUserId: input.actorUserId ?? null,
    action: "review_case.open",
    targetType: "ReviewCase",
    targetId: reviewCase.id,
    metadata: { caseType: input.caseType, entityType: input.entityType, entityId: input.entityId, tier: input.tier, priority },
  });

  return reviewCase;
}

export async function assignReviewCase(reviewCaseId: string, assignedToUserId: string, actorUserId: string) {
  const current = await prisma.reviewCase.findUniqueOrThrow({ where: { id: reviewCaseId } });

  const reviewCase = await prisma.reviewCase.update({
    where: { id: reviewCaseId },
    data: {
      assignedToUserId,
      status: "ASSIGNED",
      firstActionAt: current.firstActionAt ?? new Date(),
    },
  });

  await logAudit({
    actorUserId,
    action: "review_case.assign",
    targetType: "ReviewCase",
    targetId: reviewCaseId,
    metadata: { assignedToUserId },
  });

  return reviewCase;
}

export async function setReviewCaseStatus(
  reviewCaseId: string,
  status: Exclude<ReviewCaseStatus, "OPEN" | "ASSIGNED">,
  actorUserId: string,
) {
  const reviewCase = await prisma.reviewCase.update({
    where: { id: reviewCaseId },
    data: { status },
  });

  await logAudit({
    actorUserId,
    action: "review_case.status",
    targetType: "ReviewCase",
    targetId: reviewCaseId,
    metadata: { status },
  });

  return reviewCase;
}

/**
 * Called once the substantive record (claim/dispute/flag) actually resolves —
 * closes the workflow envelope, records the resolution-time metric, and
 * denormalizes a short `outcome` string for dashboards. Idempotent: resolving an
 * already-closed case just returns it unchanged.
 */
export async function resolveReviewCaseFor(
  input: { caseType: ReviewCaseType; entityType: string; entityId: string; outcome: string; actorUserId?: string },
) {
  const reviewCase = await prisma.reviewCase.findUnique({
    where: {
      caseType_entityType_entityId: { caseType: input.caseType, entityType: input.entityType, entityId: input.entityId },
    },
  });
  if (!reviewCase) return null;
  if (reviewCase.status === "RESOLVED" || reviewCase.status === "CLOSED") return reviewCase;

  const resolvedAt = new Date();
  const updated = await prisma.reviewCase.update({
    where: { id: reviewCase.id },
    data: { status: "RESOLVED", resolvedAt, closedAt: resolvedAt, outcome: input.outcome },
  });

  const durationMs = resolvedAt.getTime() - reviewCase.openedAt.getTime();

  await recordSafetyMetricEvent({
    metricType: `${input.caseType}_RESOLVED`,
    entityType: input.entityType,
    entityId: input.entityId,
    actorUserId: input.actorUserId,
    durationMs,
    metadata: { outcome: input.outcome, reviewCaseId: reviewCase.id },
  });

  await logAudit({
    actorUserId: input.actorUserId ?? null,
    action: "review_case.resolve",
    targetType: "ReviewCase",
    targetId: reviewCase.id,
    metadata: { outcome: input.outcome, durationMs },
  });

  return updated;
}

export async function listReviewCases(filter?: { caseType?: ReviewCaseType; status?: ReviewCaseStatus[] }) {
  return prisma.reviewCase.findMany({
    where: {
      caseType: filter?.caseType,
      status: filter?.status ? { in: filter.status } : undefined,
    },
    include: {
      subject: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ priority: "desc" }, { slaDueAt: "asc" }],
  });
}

export async function getReviewCaseFor(caseType: ReviewCaseType, entityType: string, entityId: string) {
  return prisma.reviewCase.findUnique({
    where: { caseType_entityType_entityId: { caseType, entityType, entityId } },
  });
}
