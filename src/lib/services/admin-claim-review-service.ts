import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { ReviewDecision } from "@prisma/client";

/**
 * Deliberately NOT named `claim-service.ts` — Vertical B owns that path and may define
 * an equivalent `decideClaim`. This file lets the admin claims UI work standalone; if
 * Vertical B's service exists after integration, prefer theirs and drop this one.
 */
export async function listClaims(statusFilter?: ("SUBMITTED" | "IN_REVIEW")[]) {
  return prisma.credentialClaim.findMany({
    where: { status: { in: statusFilter ?? ["SUBMITTED", "IN_REVIEW"] } },
    include: { subject: { select: { id: true, name: true, email: true } } },
    orderBy: { submittedAt: "asc" },
  });
}

export async function getClaim(claimId: string) {
  return prisma.credentialClaim.findUnique({
    where: { id: claimId },
    include: {
      subject: { select: { id: true, name: true, email: true } },
      experience: true,
      reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

const DECISION_TO_STATUS: Record<ReviewDecision, "APPROVED" | "REJECTED" | "IN_REVIEW" | "REVOKED"> = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REQUEST_MORE_INFO: "IN_REVIEW",
  REVOKED: "REVOKED",
};

export async function decideClaim(
  claimId: string,
  reviewerUserId: string,
  decision: ReviewDecision,
  notes: string | undefined,
  // Track 2 (identity & evidence): only meaningful on APPROVED — e.g. "this
  // credential verification is valid until X". Optional; most claim types don't
  // expire, so leaving it unset keeps today's behavior unchanged.
  expiresAt?: Date,
) {
  const [, claim] = await prisma.$transaction([
    prisma.verificationReview.create({
      data: { claimId, reviewerUserId, decision, notes },
    }),
    prisma.credentialClaim.update({
      where: { id: claimId },
      data: {
        status: DECISION_TO_STATUS[decision],
        decidedAt: new Date(),
        expiresAt: decision === "APPROVED" ? expiresAt ?? null : undefined,
        // Keep the revoke reason/timestamp readable directly off the claim, same
        // shape BadgeAward already uses, without replacing the VerificationReview
        // row as the actual audit trail — that still always gets written above.
        revokedAt: decision === "REVOKED" ? new Date() : undefined,
        revokedReason: decision === "REVOKED" ? notes ?? null : undefined,
      },
    }),
  ]);

  await logAudit({
    actorUserId: reviewerUserId,
    action: `CLAIM_${decision}`,
    targetType: "CredentialClaim",
    targetId: claimId,
    metadata: { notes },
  });

  return claim;
}

/** Lazy expiry check — evaluated on read, no scheduler/cron exists in this app. */
export function isClaimExpired(claim: { expiresAt: Date | null }): boolean {
  return Boolean(claim.expiresAt && claim.expiresAt.getTime() < Date.now());
}
