import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { RelationshipAuthError, RelationshipStateError } from "@/lib/services/relationship-service";
import { decideClaim } from "@/lib/services/admin-claim-review-service";
import { appealClaim, resolveClaimAppeal } from "@/lib/services/claim-appeal-service";

/**
 * Track 2 (identity & evidence): the appeals path for a claim decision — only the
 * claim's own subject can appeal, only once it's actually been decided against them
 * (REJECTED/REVOKED), and resolving the appeal never silently mutates the claim's
 * status itself (that still requires an explicit decideClaim() call, so there's
 * always a VerificationReview row for any status change).
 */

const RUN_ID = `test-appeal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${label}.${RUN_ID}@test.invalid`,
      name: `${label} ${RUN_ID}`,
      status: "ACTIVE",
    },
  });
}

describe("claim-appeal-service invariants", () => {
  let subject: { id: string };
  let other: { id: string };
  let admin: { id: string };

  beforeAll(async () => {
    subject = await makeUser("subject");
    other = await makeUser("other");
    admin = await makeUser("admin");
  });

  afterAll(async () => {
    // ClaimAppeal.raisedByUserId and VerificationReview.reviewerUserId have no
    // cascade (RESTRICT) — delete them (and the claims they hang off) explicitly
    // before deleting the users, rather than relying on cascade-ordering across two
    // different FK paths to the same user row.
    await prisma.claimAppeal.deleteMany({ where: { raisedBy: { email: { contains: RUN_ID } } } });
    await prisma.verificationReview.deleteMany({ where: { reviewer: { email: { contains: RUN_ID } } } });
    await prisma.credentialClaim.deleteMany({ where: { subject: { email: { contains: RUN_ID } } } });
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
  });

  it("refuses to appeal a claim that hasn't been decided yet", async () => {
    const claim = await prisma.credentialClaim.create({
      data: { subjectUserId: subject.id, claimType: "IDENTITY", title: `Claim ${RUN_ID}` },
    });

    await expect(appealClaim(claim.id, subject.id, "too early")).rejects.toBeInstanceOf(RelationshipStateError);
  });

  it("refuses to let anyone but the claim's own subject appeal", async () => {
    const claim = await prisma.credentialClaim.create({
      data: { subjectUserId: subject.id, claimType: "IDENTITY", title: `Claim2 ${RUN_ID}` },
    });
    await decideClaim(claim.id, admin.id, "REJECTED", "not enough evidence");

    await expect(appealClaim(claim.id, other.id, "not mine to appeal")).rejects.toBeInstanceOf(
      RelationshipAuthError,
    );
  });

  it("lets the subject appeal a REJECTED claim, and refuses a second open appeal", async () => {
    const claim = await prisma.credentialClaim.create({
      data: { subjectUserId: subject.id, claimType: "CREDENTIAL", title: `Claim3 ${RUN_ID}` },
    });
    await decideClaim(claim.id, admin.id, "REJECTED", "insufficient documentation");

    const appeal = await appealClaim(claim.id, subject.id, "I have more evidence now");
    expect(appeal.status).toBe("OPEN");

    await expect(appealClaim(claim.id, subject.id, "again")).rejects.toBeInstanceOf(RelationshipStateError);
  });

  it("resolving an appeal records the outcome but never mutates the claim's own status", async () => {
    const claim = await prisma.credentialClaim.create({
      data: { subjectUserId: subject.id, claimType: "EXPERIENCE", title: `Claim4 ${RUN_ID}` },
    });
    await decideClaim(claim.id, admin.id, "REJECTED", "initial rejection");
    const appeal = await appealClaim(claim.id, subject.id, "please reconsider");

    const resolved = await resolveClaimAppeal(appeal.id, "RESOLVED_UPHELD", "original decision stands", admin.id);
    expect(resolved.status).toBe("RESOLVED_UPHELD");

    const claimAfter = await prisma.credentialClaim.findUniqueOrThrow({ where: { id: claim.id } });
    expect(claimAfter.status).toBe("REJECTED");

    // Reversing the decision still requires the explicit, separately-audited decideClaim path.
    const reversed = await decideClaim(claim.id, admin.id, "APPROVED", "appeal persuaded us");
    expect(reversed.status).toBe("APPROVED");
  });
});
