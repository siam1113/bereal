import { prisma } from "@/lib/prisma";
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
    include: {
      reviews: { orderBy: { createdAt: "asc" } },
      // Track 2 (identity & evidence): appeals path — the subject's own claim view
      // needs to see its appeal history to decide whether to appeal again.
      appeals: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!claim || claim.subjectUserId !== subjectUserId) return null;
  return claim;
}
