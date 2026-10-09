import { prisma } from "@/lib/prisma";
import { decideVerificationTier, openReviewCase } from "@/lib/services/review-case-service";
import type { ClaimType } from "@prisma/client";

// Admin-side review (decideClaim/listClaims/getClaim) lives in
// src/lib/services/admin-claim-review-service.ts, owned by the admin vertical. This file
// is the subject-side submission half only — intentionally not re-exporting the admin
// functions, since nothing outside the admin dashboard needs them and the two services
// were built independently in parallel.

export async function submitClaim(input: {
  subjectUserId: string;
  claimType: ClaimType;
  title: string;
  description?: string;
  evidenceUrls?: string[];
  relatedExperienceId?: string;
}) {
  const claim = await prisma.credentialClaim.create({
    data: {
      subjectUserId: input.subjectUserId,
      claimType: input.claimType,
      title: input.title,
      description: input.description,
      evidenceUrls: input.evidenceUrls ?? [],
      relatedExperienceId: input.relatedExperienceId,
    },
  });

  // Track 9 (trust/safety/moderation at scale): route into a tiered review queue
  // (quick-path vs. deep-review) instead of one undifferentiated FIFO queue — see
  // `review-case-service.ts#decideVerificationTier` for the placeholder heuristic
  // and this track's report for why real tiering criteria is a policy call.
  await openReviewCase({
    caseType: "VERIFICATION",
    entityType: "CREDENTIAL_CLAIM",
    entityId: claim.id,
    subjectUserId: input.subjectUserId,
    tier: decideVerificationTier({ claimType: input.claimType, evidenceUrlCount: (input.evidenceUrls ?? []).length }),
    actorUserId: input.subjectUserId,
  });

  return claim;
}

export async function listMyClaims(subjectUserId: string) {
  return prisma.credentialClaim.findMany({
    where: { subjectUserId },
    include: { reviews: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { submittedAt: "desc" },
  });
}

export async function getMyClaimDetail(claimId: string, subjectUserId: string) {
  const claim = await prisma.credentialClaim.findUnique({
    where: { id: claimId },
    include: { reviews: { orderBy: { createdAt: "asc" } } },
  });
  if (!claim || claim.subjectUserId !== subjectUserId) return null;
  return claim;
}
