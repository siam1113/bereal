import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { RelationshipAuthError, RelationshipStateError } from "@/lib/services/relationship-service";
import type { DisputeStatus } from "@prisma/client";

/**
 * Track 2 (identity & evidence): the appeals path for a claim decision the subject
 * contests. Only the claim's own subject can appeal, and only once the claim has
 * actually been decided against them (REJECTED or REVOKED) — appealing a claim that's
 * still SUBMITTED/IN_REVIEW or already APPROVED doesn't make sense.
 */
const APPEALABLE_STATUSES = ["REJECTED", "REVOKED"] as const;

export async function appealClaim(claimId: string, raisedByUserId: string, reason: string) {
  const claim = await prisma.credentialClaim.findUniqueOrThrow({ where: { id: claimId } });
  if (claim.subjectUserId !== raisedByUserId) {
    throw new RelationshipAuthError("Only the claim's own subject can appeal its decision");
  }
  if (!APPEALABLE_STATUSES.includes(claim.status as (typeof APPEALABLE_STATUSES)[number])) {
    throw new RelationshipStateError(`A ${claim.status} claim isn't in an appealable state`);
  }

  const existingOpen = await prisma.claimAppeal.findFirst({
    where: { claimId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
  });
  if (existingOpen) {
    throw new RelationshipStateError("This claim already has an open appeal");
  }

  const appeal = await prisma.claimAppeal.create({
    data: { claimId, raisedByUserId, reason },
  });

  await logAudit({
    actorUserId: raisedByUserId,
    action: "claim.appeal.raise",
    targetType: "CredentialClaim",
    targetId: claimId,
    metadata: { appealId: appeal.id, reason },
  });

  return appeal;
}

export async function listMyClaimAppeals(raisedByUserId: string) {
  return prisma.claimAppeal.findMany({
    where: { raisedByUserId },
    include: { claim: { select: { id: true, title: true, status: true, claimType: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Admin review queue — mirrors admin-dispute-service.ts's listDisputes/resolveDispute pair. */
export async function listClaimAppeals(statusFilter?: DisputeStatus[]) {
  return prisma.claimAppeal.findMany({
    where: statusFilter ? { status: { in: statusFilter } } : undefined,
    include: {
      raisedBy: { select: { id: true, name: true, email: true } },
      claim: {
        select: {
          id: true,
          title: true,
          status: true,
          claimType: true,
          subject: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Resolving an appeal only records the outcome (RESOLVED_UPHELD = original decision
 * stands, RESOLVED_REMOVED = appeal dismissed/withdrawn) — it does not itself change
 * CredentialClaim.status. An admin who decides the appeal should overturn the original
 * decision uses the existing decideClaim() path explicitly, so there's always a
 * VerificationReview row (reviewer, decision, notes, timestamp) for any status change,
 * never one implied only by an appeal record. Same "explicit action over implicit
 * side effect" precedent as resolveDispute()/resolveReferenceDispute().
 */
export async function resolveClaimAppeal(
  appealId: string,
  resolution: "RESOLVED_UPHELD" | "RESOLVED_REMOVED",
  notes: string,
  adminUserId: string,
) {
  const appeal = await prisma.claimAppeal.update({
    where: { id: appealId },
    data: { status: resolution, resolutionNotes: notes, resolvedAt: new Date() },
  });

  await logAudit({
    actorUserId: adminUserId,
    action: `CLAIM_APPEAL_${resolution}`,
    targetType: "ClaimAppeal",
    targetId: appealId,
    metadata: { claimId: appeal.claimId, notes },
  });

  return appeal;
}
