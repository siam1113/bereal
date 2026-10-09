import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  RelationshipAuthError,
  RelationshipStateError,
  confirmRelationship,
  respondToRelationshipRequest,
} from "@/lib/services/relationship-service";
import {
  createReference,
  disputeReference,
  isReferenceExpired,
  setReferenceVisibility,
} from "@/lib/services/reference-service";

/**
 * Track 2 (identity & evidence): covers the invariant that makes a Reference a
 * genuinely stronger evidence tier than Endorsement/ProfessionalFeedback — it can't
 * even be CREATED against a merely self-declared relationship (those two just mark
 * the result UNVERIFIED instead) — plus the subject-only visibility/dispute controls.
 * Runs against a real local Postgres, same pattern as relationship-service.test.ts:
 * throwaway users created and torn down in this file.
 */

const RUN_ID = `test-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${label}.${RUN_ID}@test.invalid`,
      name: `${label} ${RUN_ID}`,
      status: "ACTIVE",
    },
  });
}

describe("reference-service invariants", () => {
  let author: { id: string };
  let subject: { id: string };
  let stranger: { id: string };

  beforeAll(async () => {
    author = await makeUser("author");
    subject = await makeUser("subject");
    stranger = await makeUser("stranger");
  });

  afterAll(async () => {
    // ReferenceDispute.raisedByUserId has no cascade (RESTRICT) — delete it (and the
    // Reference rows it hangs off) explicitly before deleting the users, rather than
    // relying on cascade-ordering across two different FK paths to the same user row.
    await prisma.referenceDispute.deleteMany({ where: { raisedBy: { email: { contains: RUN_ID } } } });
    await prisma.reference.deleteMany({
      where: { OR: [{ author: { email: { contains: RUN_ID } } }, { subject: { email: { contains: RUN_ID } } }] },
    });
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
  });

  it("refuses to create a reference against a self-declared (not yet confirmed) relationship", async () => {
    const request = await prisma.relationshipRequest.create({
      data: {
        fromUserId: author.id,
        toUserId: subject.id,
        proposedType: "WORKED_WITH",
        intent: "WANT_TO_COLLABORATE",
      },
    });
    const { relationship } = await respondToRelationshipRequest(request.id, subject.id, true);
    expect(relationship!.confirmationStatus).toBe("SELF_DECLARED");

    await expect(
      createReference({
        authorUserId: author.id,
        subjectUserId: subject.id,
        relationshipId: relationship!.id,
        attributes: { communication: 5, reliability: 5, timeManagement: 5 },
      }),
    ).rejects.toBeInstanceOf(RelationshipAuthError);

    const count = await prisma.reference.count({ where: { relationshipId: relationship!.id } });
    expect(count).toBe(0);
  });

  it("allows creating a reference once the relationship is mutually confirmed", async () => {
    const relationship = await prisma.relationship.findFirstOrThrow({
      where: { partyAUserId: author.id, partyBUserId: subject.id, type: "WORKED_WITH" },
    });
    await confirmRelationship(relationship.id, subject.id);

    const reference = await createReference({
      authorUserId: author.id,
      subjectUserId: subject.id,
      relationshipId: relationship.id,
      attributes: { communication: 5, reliability: 4, timeManagement: 5 },
      comment: "Great to work with.",
    });

    expect(reference.status).toBe("SUBMITTED");
    expect(reference.visibility).toBe("PUBLIC");
  });

  it("rejects a reference attempt between two people who aren't actually party to the relationship", async () => {
    const relationship = await prisma.relationship.findFirstOrThrow({
      where: { partyAUserId: author.id, partyBUserId: subject.id, type: "WORKED_WITH" },
    });

    await expect(
      createReference({
        authorUserId: stranger.id,
        subjectUserId: subject.id,
        relationshipId: relationship.id,
        attributes: { communication: 5, reliability: 5, timeManagement: 5 },
      }),
    ).rejects.toBeInstanceOf(RelationshipAuthError);
  });

  it("only lets the subject change a reference's visibility", async () => {
    const reference = await prisma.reference.findFirstOrThrow({
      where: { authorUserId: author.id, subjectUserId: subject.id },
    });

    await expect(setReferenceVisibility(reference.id, author.id, "PRIVATE")).rejects.toBeInstanceOf(
      RelationshipAuthError,
    );

    const updated = await setReferenceVisibility(reference.id, subject.id, "PRIVATE");
    expect(updated.visibility).toBe("PRIVATE");
  });

  it("only lets the subject dispute a reference, flipping status to DISPUTED and opening a ReferenceDispute", async () => {
    const reference = await prisma.reference.findFirstOrThrow({
      where: { authorUserId: author.id, subjectUserId: subject.id },
    });

    await expect(disputeReference(reference.id, author.id, "I wrote this, I can't dispute it")).rejects.toBeInstanceOf(
      RelationshipAuthError,
    );

    const dispute = await disputeReference(reference.id, subject.id, "This doesn't reflect what happened");
    expect(dispute.status).toBe("OPEN");

    const updated = await prisma.reference.findUniqueOrThrow({ where: { id: reference.id } });
    expect(updated.status).toBe("DISPUTED");
  });

  it("refuses a second dispute once the reference has been revoked", async () => {
    const reference = await prisma.reference.findFirstOrThrow({
      where: { authorUserId: author.id, subjectUserId: subject.id },
    });
    await prisma.reference.update({ where: { id: reference.id }, data: { status: "REVOKED" } });

    await expect(disputeReference(reference.id, subject.id, "again")).rejects.toBeInstanceOf(RelationshipStateError);
  });

  it("treats a reference with a past expiresAt as expired", () => {
    expect(isReferenceExpired({ expiresAt: new Date(Date.now() - 1000) })).toBe(true);
    expect(isReferenceExpired({ expiresAt: new Date(Date.now() + 1000 * 60 * 60) })).toBe(false);
    expect(isReferenceExpired({ expiresAt: null })).toBe(false);
  });
});
