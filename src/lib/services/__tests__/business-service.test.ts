import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// business-service.ts imports `requireUser`/`ForbiddenError` from auth-helpers.ts for
// its other (pre-existing, route-driven) functions, which in turn imports Auth.js's
// `auth()` from @/lib/auth — and next-auth's package doesn't resolve cleanly outside
// Next's own module loader (fails on `next/server` resolution under plain Vite/
// Vitest). Mock the module one level down so loading business-service.ts in this test
// never touches real next-auth; nothing under test here calls `auth()`/`requireUser()`
// anyway (see the "takes userId explicitly" note on the functions under test).
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth-helpers";
import { decideClaim } from "@/lib/services/admin-claim-review-service";
import {
  getBusinessAnalytics,
  getBusinessBySlug,
  getMembershipForViewer,
  recordStorefrontView,
  requestMembershipVerification,
} from "@/lib/services/business-service";

/**
 * Covers Track 6 (business tooling) additions: the verified-membership tier layered
 * on top of owner-confirmed membership, and aggregate-only business analytics. Runs
 * against a real local Postgres (see docs/testing.md), creating/tearing down its own
 * throwaway users/business.
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

describe("business-service: verified memberships and analytics", () => {
  let owner: { id: string };
  let member: { id: string };
  let outsider: { id: string };
  let admin: { id: string };
  let businessId: string;
  let businessSlug: string;

  beforeAll(async () => {
    owner = await makeUser("owner");
    member = await makeUser("member");
    outsider = await makeUser("outsider");
    admin = await makeUser("admin");

    businessSlug = `test-business-${RUN_ID}`;
    const business = await prisma.business.create({
      data: { slug: businessSlug, name: `Test Business ${RUN_ID}`, ownerUserId: owner.id },
    });
    businessId = business.id;

    await prisma.businessMembership.create({
      data: { businessId, userId: owner.id, role: "OWNER", status: "CONFIRMED", confirmedAt: new Date() },
    });
  });

  afterAll(async () => {
    // VerificationReview.reviewerUserId has no onDelete: Cascade (by design — see
    // data-model.md invariant #8), so the admin's review rows must go before the
    // admin user does; delete those (and the claim they reference) explicitly rather
    // than relying on cascade ordering across a multi-row user delete.
    await prisma.verificationReview.deleteMany({ where: { reviewerUserId: admin.id } });
    await prisma.credentialClaim.deleteMany({ where: { subjectUserId: member.id } });
    await prisma.businessAnalyticsEvent.deleteMany({ where: { businessId } });
    await prisma.serviceOffering.deleteMany({ where: { businessId } });
    await prisma.businessMembership.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
  });

  it("refuses to let a member request verification before the owner confirms their membership", async () => {
    await prisma.businessMembership.create({
      data: { businessId, userId: member.id, role: "MEMBER", status: "PENDING" },
    });

    await expect(requestMembershipVerification(businessId, member.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets a member request verification once owner-confirmed, filing a CredentialClaim", async () => {
    await prisma.businessMembership.update({
      where: { businessId_userId: { businessId, userId: member.id } },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    const claim = await requestMembershipVerification(businessId, member.id);
    expect(claim.status).toBe("SUBMITTED");
    expect(claim.subjectUserId).toBe(member.id);
    expect(claim.claimType).toBe("EXPERIENCE");

    const membership = await prisma.businessMembership.findUniqueOrThrow({
      where: { businessId_userId: { businessId, userId: member.id } },
    });
    expect(membership.verificationClaimId).toBe(claim.id);
  });

  it("does not show the membership as verified in the storefront read model until the claim is approved", async () => {
    const business = await getBusinessBySlug(businessSlug);
    const memberRow = business!.memberships.find((m) => m.userId === member.id);
    expect(memberRow?.verificationClaim?.status).toBe("SUBMITTED");
  });

  it("surfaces the membership as verified via live claim status, once an admin approves it", async () => {
    const membership = await prisma.businessMembership.findUniqueOrThrow({
      where: { businessId_userId: { businessId, userId: member.id } },
    });

    await decideClaim(membership.verificationClaimId!, admin.id, "APPROVED", "Looks right");

    const business = await getBusinessBySlug(businessSlug);
    const memberRow = business!.memberships.find((m) => m.userId === member.id);
    expect(memberRow?.verificationClaim?.status).toBe("APPROVED");

    const viewerMembership = await getMembershipForViewer(businessId, member.id);
    expect(viewerMembership?.verificationClaim?.status).toBe("APPROVED");
  });

  it("only the owner can read business analytics", async () => {
    await expect(getBusinessAnalytics(businessId, outsider.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("excludes the owner's and confirmed members' own storefront views from analytics, counts others", async () => {
    await recordStorefrontView(businessId, owner.id); // self-view, excluded
    await recordStorefrontView(businessId, member.id); // confirmed member, excluded
    await recordStorefrontView(businessId, outsider.id); // counted
    await recordStorefrontView(businessId, null); // anonymous, counted

    const analytics = await getBusinessAnalytics(businessId, owner.id);
    expect(analytics.totalViews).toBe(2);
    expect(analytics.recentViews).toBe(2);
  });

  it("computes inquiry counts/rate per service from the existing Inquiry table, not a duplicate event", async () => {
    const service = await prisma.serviceOffering.create({
      data: { businessId, title: "Repairs", description: "General repairs" },
    });
    await prisma.inquiry.create({
      data: { serviceOfferingId: service.id, inquirerUserId: outsider.id, message: "Hi, available this week?" },
    });

    const analytics = await getBusinessAnalytics(businessId, owner.id);
    const serviceRow = analytics.services.find((s) => s.id === service.id);
    expect(serviceRow?.inquiries).toBe(1);
    expect(analytics.totalInquiries).toBeGreaterThanOrEqual(1);
    expect(analytics.inquiryRate).not.toBeNull();
  });
});
