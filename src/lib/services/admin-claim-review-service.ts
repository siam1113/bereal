import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { resolveReviewCaseFor } from "@/lib/services/review-case-service";
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
) {
  const [, claim] = await prisma.$transaction([
    prisma.verificationReview.create({
      data: { claimId, reviewerUserId, decision, notes },
    }),
    prisma.credentialClaim.update({
      where: { id: claimId },
      data: { status: DECISION_TO_STATUS[decision], decidedAt: new Date() },
    }),
  ]);

  await logAudit({
    actorUserId: reviewerUserId,
    action: `CLAIM_${decision}`,
    targetType: "CredentialClaim",
    targetId: claimId,
    metadata: { notes },
  });

  // Track 9: close the tiered-review workflow envelope on a terminal decision only
  // — REQUEST_MORE_INFO leaves the claim IN_REVIEW, so the case stays open. REVOKED
  // is recorded distinctly: a previously APPROVED claim later revoked is the
  // closest real signal this worktree has to "false verification," though the real
  // metric needs Track 2's ClaimAppeal — see safety-metrics-service.ts.
  if (decision !== "REQUEST_MORE_INFO") {
    await resolveReviewCaseFor({
      caseType: "VERIFICATION",
      entityType: "CREDENTIAL_CLAIM",
      entityId: claimId,
      outcome: decision,
      actorUserId: reviewerUserId,
    });
  }

  return claim;
}
