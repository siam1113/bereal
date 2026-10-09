import { prisma } from "@/lib/prisma";
import type { ClaimType } from "@prisma/client";

// Admin-side review (decideClaim/listClaimsQueue/getClaimDetail/markClaimInReview) already
// lives in src/lib/services/admin-claim-service.ts — written while this file didn't exist
// yet. Re-exporting rather than duplicating keeps one source of truth for the review
// workflow; this file adds the subject-side submission half.
export {
  decideClaim,
  getClaimDetail,
  listClaimsQueue,
  markClaimInReview,
} from "@/lib/services/admin-claim-service";

export async function submitClaim(input: {
  subjectUserId: string;
  claimType: ClaimType;
  title: string;
  description?: string;
  evidenceUrls?: string[];
  relatedExperienceId?: string;
}) {
  return prisma.credentialClaim.create({
    data: {
      subjectUserId: input.subjectUserId,
      claimType: input.claimType,
      title: input.title,
      description: input.description,
      evidenceUrls: input.evidenceUrls ?? [],
      relatedExperienceId: input.relatedExperienceId,
    },
  });
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
