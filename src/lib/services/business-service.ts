import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth-helpers";
import { uniqueSlug } from "@/lib/slug";
import { logAudit } from "@/lib/audit";

interface BusinessInput {
  name: string;
  description?: string;
  city?: string;
  region?: string;
  country?: string;
}

/**
 * The storefront read model: a business's public page needs team, portfolio, and
 * active services in one structured fetch. No new models here — this is the
 * "likely a UI/read-model concern more than new schema" storefront from
 * docs/roadmap/06-business-tooling.md, built entirely on existing tables.
 */
export async function getBusinessBySlug(slug: string) {
  return prisma.business.findUnique({
    where: { slug },
    include: {
      memberships: {
        where: { status: "CONFIRMED" },
        include: {
          user: { include: { personProfile: true } },
          // Verified-membership tier: a membership is "verified" only once its backing
          // claim has been admin-APPROVED (see `requestMembershipVerification` below).
          verificationClaim: { select: { status: true } },
        },
      },
      portfolioItems: { where: { visibility: "PUBLIC" }, orderBy: { createdAt: "desc" } },
      serviceOfferings: {
        where: { isActive: true },
        include: { skill: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getOwnBusinessById(id: string) {
  const user = await requireUser();
  const business = await prisma.business.findUniqueOrThrow({ where: { id } });
  if (business.ownerUserId !== user.id) throw new Error("Only the owner can manage this business");
  return business;
}

export async function listOwnBusinesses() {
  const user = await requireUser();
  return prisma.business.findMany({
    where: {
      OR: [{ ownerUserId: user.id }, { memberships: { some: { userId: user.id, status: "CONFIRMED" } } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createBusiness(input: BusinessInput) {
  const user = await requireUser();
  const slug = await uniqueSlug(input.name, async (candidate) => {
    const found = await prisma.business.findUnique({ where: { slug: candidate } });
    return !!found;
  });

  const business = await prisma.business.create({
    data: {
      slug,
      name: input.name,
      description: input.description,
      city: input.city,
      region: input.region,
      country: input.country,
      ownerUserId: user.id,
    },
  });

  await prisma.businessMembership.create({
    data: { businessId: business.id, userId: user.id, role: "OWNER", status: "CONFIRMED", confirmedAt: new Date() },
  });

  return business;
}

export async function updateBusiness(id: string, input: BusinessInput) {
  const user = await requireUser();
  const business = await prisma.business.findUniqueOrThrow({ where: { id } });
  if (business.ownerUserId !== user.id) throw new Error("Only the owner can edit this business");

  return prisma.business.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      city: input.city,
      region: input.region,
      country: input.country,
    },
  });
}

/**
 * Anyone can claim membership in a business; it starts PENDING and is never
 * auto-confirmed — only the owner (or an admin) confirming it moves it to CONFIRMED.
 */
export async function claimBusinessMembership(businessId: string) {
  const user = await requireUser();
  return prisma.businessMembership.upsert({
    where: { businessId_userId: { businessId, userId: user.id } },
    update: {},
    create: { businessId, userId: user.id, role: "MEMBER", status: "PENDING" },
  });
}

export async function confirmBusinessMembership(businessId: string, memberUserId: string) {
  const user = await requireUser();
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (business.ownerUserId !== user.id) throw new Error("Only the owner can confirm memberships");

  return prisma.businessMembership.update({
    where: { businessId_userId: { businessId, userId: memberUserId } },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
}

export async function listMembershipsForOwner(businessId: string) {
  const user = await requireUser();
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (business.ownerUserId !== user.id) throw new Error("Only the owner can view pending membership claims");

  return prisma.businessMembership.findMany({
    where: { businessId },
    include: { user: { include: { personProfile: true } }, verificationClaim: { select: { status: true } } },
    orderBy: { claimedAt: "desc" },
  });
}

// ------------------------------------------------------------------------------------
// Verified memberships
// ------------------------------------------------------------------------------------
//
// Tier 1: self-declared (BusinessMembership.status === "PENDING").
// Tier 2: owner-confirmed (BusinessMembership.status === "CONFIRMED") — existing V1.
// Tier 3 (new, this track): verified — the member backs their CONFIRMED membership
// with a CredentialClaim, reviewed by an admin through the existing claim pipeline
// (admin-claim-review-service.ts#decideClaim, unchanged). A membership is "verified"
// only when `verificationClaim.status === "APPROVED"`.
//
// This reuses V1's claim/VerificationReview machinery because Track 2's `Reference`
// model (src/lib/services/reference-service.ts — a confirmed-relationship-gated
// structured reference) is not present in this worktree. It is the named integration
// point: once Track 2 lands, a human integrator should consider backing verified
// memberships with a Reference (e.g. given by another confirmed member/owner of the
// same business) instead of, or in addition to, a generic CredentialClaim. Search
// this file and `verificationClaimId` in prisma/schema.prisma for the exact seam.

/**
 * The signed-in viewer's own membership row for a business, if any — used by the
 * storefront page to decide whether to show "claim membership", "pending
 * confirmation", "request verification", or "verified member" for the current user.
 * Returns null for anonymous viewers or viewers with no membership claim on file.
 */
export async function getMembershipForViewer(businessId: string, viewerUserId: string | null) {
  if (!viewerUserId) return null;
  return prisma.businessMembership.findUnique({
    where: { businessId_userId: { businessId, userId: viewerUserId } },
    include: { verificationClaim: { select: { status: true } } },
  });
}

/**
 * The member themselves requests verification of their own (already owner-confirmed)
 * membership by filing a CredentialClaim. Only the member can request this — not the
 * owner — consistent with CredentialClaim.subjectUserId always being the person the
 * claim is about. Admins review it exactly like any other claim at /admin/claims.
 *
 * Takes `userId` explicitly (the caller — a route handler — resolves it via
 * `requireUser()`) rather than calling `requireUser()` here, unlike the rest of this
 * file. That's a deliberate deviation for this one function: it mirrors
 * relationship-service.ts's tested pattern of ambient-auth-free service functions, so
 * this invariant-bearing logic (gating on CONFIRMED status, blocking duplicate live
 * claims) can be covered by a real integration test without mocking Auth.js sessions —
 * see src/lib/services/__tests__/business-service.test.ts.
 */
export async function requestMembershipVerification(businessId: string, userId: string) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const membership = await prisma.businessMembership.findUnique({
    where: { businessId_userId: { businessId, userId } },
  });
  if (!membership) throw new ForbiddenError("No membership claim found for this business");
  if (membership.status !== "CONFIRMED") {
    throw new ForbiddenError("Membership must be owner-confirmed before requesting verification");
  }
  if (membership.verificationClaimId) {
    const existing = await prisma.credentialClaim.findUniqueOrThrow({ where: { id: membership.verificationClaimId } });
    // Only block re-requesting while a claim is live (pending or already approved);
    // a rejected/revoked claim can be superseded by a fresh request below.
    if (existing.status === "SUBMITTED" || existing.status === "IN_REVIEW" || existing.status === "APPROVED") {
      return existing;
    }
  }

  const claim = await prisma.credentialClaim.create({
    data: {
      subjectUserId: userId,
      // Closest existing ClaimType to "membership at this business" — see the
      // integration-point note above for why this isn't a bespoke claim type.
      claimType: "EXPERIENCE",
      title: `Verified membership: ${business.name}`,
      description: `Self-requested verification of an owner-confirmed membership at ${business.name} (businessId=${business.id}, membershipId=${membership.id}).`,
    },
  });

  await prisma.businessMembership.update({
    where: { businessId_userId: { businessId, userId } },
    data: { verificationClaimId: claim.id },
  });

  await logAudit({
    actorUserId: userId,
    action: "MEMBERSHIP_VERIFICATION_REQUESTED",
    targetType: "BusinessMembership",
    targetId: membership.id,
    metadata: { businessId, claimId: claim.id },
  });

  return claim;
}

/**
 * NOT wired to run automatically. Every "is this membership verified" check in this
 * codebase (storefront page, membership-status-panel) reads `verificationClaim.status
 * === "APPROVED"` live, the same "recompute server-side every time, never trust a
 * cached flag" pattern as endorsement verification (data-model.md invariant #2) — so
 * correctness never depends on this function having run.
 *
 * It exists only as an optional convenience for a future admin-side hook (e.g. inside
 * admin-claim-review-service.ts#decideClaim, or a cron) that wants a denormalized
 * `verifiedAt` timestamp for sorting/display ("verified since"). Call it after a claim
 * decision if that's ever wanted; nothing currently does.
 */
export async function syncMembershipVerificationStatus(membershipId: string) {
  const membership = await prisma.businessMembership.findUniqueOrThrow({
    where: { id: membershipId },
    include: { verificationClaim: true },
  });
  if (membership.verificationClaim?.status === "APPROVED" && !membership.verifiedAt) {
    return prisma.businessMembership.update({
      where: { id: membershipId },
      data: { verifiedAt: new Date() },
    });
  }
  if (membership.verificationClaim?.status !== "APPROVED" && membership.verifiedAt) {
    // Claim was revoked/rejected after the fact — un-stamp.
    return prisma.businessMembership.update({
      where: { id: membershipId },
      data: { verifiedAt: null },
    });
  }
  return membership;
}

// ------------------------------------------------------------------------------------
// Analytics
// ------------------------------------------------------------------------------------
//
// Deliberately aggregate-only. Policy question flagged in docs/roadmap/06-business-
// tooling.md: "whether business analytics expose anything that could re-identify
// individual viewers." Conservative, reversible choice made here (logged in
// docs/decisions.md): never return a per-viewer breakdown to the business owner, only
// counts/rates. `viewerUserId` is stored so a future dedupe/fraud pass can use it, but
// no function in this file ever projects it back out per-row.

const ANALYTICS_WINDOW_DAYS = 30;

/**
 * Records a storefront page view. Skips the business owner and any CONFIRMED member
 * viewing their own storefront, so owners can't inflate their own view count just by
 * visiting their own page. Anonymous (signed-out) views are recorded with a null
 * `viewerUserId`.
 */
export async function recordStorefrontView(businessId: string, viewerUserId: string | null) {
  if (viewerUserId) {
    const business = await prisma.business.findUnique({ where: { id: businessId }, select: { ownerUserId: true } });
    if (!business) return;
    if (business.ownerUserId === viewerUserId) return;
    const isConfirmedMember = await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId, userId: viewerUserId } },
      select: { status: true },
    });
    if (isConfirmedMember?.status === "CONFIRMED") return;
  }

  await prisma.businessAnalyticsEvent.create({
    data: { businessId, type: "STOREFRONT_VIEW", viewerUserId },
  });
}

/**
 * Owner-only aggregate analytics: total/recent storefront views, a daily view series
 * for the last `ANALYTICS_WINDOW_DAYS` days, and inquiry counts/rate per active
 * service offering. Inquiry counts come from the existing `Inquiry` table (joined
 * through `ServiceOffering.businessId`) rather than a duplicate event — one source of
 * truth for "someone inquired."
 *
 * Takes `userId` explicitly rather than calling `requireUser()` — see the note on
 * `requestMembershipVerification` above for why; this function is also covered by
 * the integration test.
 */
export async function getBusinessAnalytics(businessId: string, userId: string) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (business.ownerUserId !== userId) throw new ForbiddenError("Only the owner can view business analytics");

  const windowStart = new Date(Date.now() - ANALYTICS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [totalViews, recentViews, recentViewRows, services] = await Promise.all([
    prisma.businessAnalyticsEvent.count({ where: { businessId, type: "STOREFRONT_VIEW" } }),
    prisma.businessAnalyticsEvent.count({
      where: { businessId, type: "STOREFRONT_VIEW", createdAt: { gte: windowStart } },
    }),
    prisma.businessAnalyticsEvent.findMany({
      where: { businessId, type: "STOREFRONT_VIEW", createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.serviceOffering.findMany({
      where: { businessId },
      select: {
        id: true,
        title: true,
        isActive: true,
        _count: { select: { inquiries: true } },
      },
    }),
  ]);

  // Bucket views by calendar day (UTC) for a simple sparkline — aggregate only, no
  // per-viewer rows ever leave this function.
  const viewsByDay = new Map<string, number>();
  for (const row of recentViewRows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    viewsByDay.set(day, (viewsByDay.get(day) ?? 0) + 1);
  }

  const totalInquiries = services.reduce((sum, s) => sum + s._count.inquiries, 0);

  return {
    totalViews,
    recentViews,
    windowDays: ANALYTICS_WINDOW_DAYS,
    viewsByDay: Array.from(viewsByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    totalInquiries,
    inquiryRate: totalViews > 0 ? totalInquiries / totalViews : null,
    services: services.map((s) => ({
      id: s.id,
      title: s.title,
      isActive: s.isActive,
      inquiries: s._count.inquiries,
    })),
  };
}
