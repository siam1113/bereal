import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  RelationshipAuthError,
  confirmRelationship,
  respondToRelationshipRequest,
  setParticipantVisibility,
} from "@/lib/services/relationship-service";
import { createEndorsement } from "@/lib/services/endorsement-service";

/**
 * Covers the plan's non-negotiable V1 invariants (section 2 / 7): a self-declared
 * relationship can't be confirmed by its own declarer, visibility is strictly
 * per-participant, and endorsement verification status is recomputed server-side from
 * the relationship's actual confirmation state. Runs against a real local Postgres
 * (matching IMPLEMENTATION_PLAN.md's testing approach) using throwaway users this file
 * creates and tears down itself.
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

describe("relationship-service invariants", () => {
  let declarer: { id: string };
  let counterpart: { id: string };
  let skillId: string;

  beforeAll(async () => {
    declarer = await makeUser("declarer");
    counterpart = await makeUser("counterpart");
    const skill = await prisma.skill.create({
      data: { slug: `test-skill-${RUN_ID}`, name: `Test skill ${RUN_ID}`, categoryGroup: "OTHER" },
    });
    skillId = skill.id;
  });

  afterAll(async () => {
    // User delete cascades to relationships/endorsements/etc (schema onDelete: Cascade),
    // so it must run before deleting the skills those endorsements reference.
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
    await prisma.skill.deleteMany({ where: { slug: { contains: RUN_ID } } });
  });

  it("creates a self-declared relationship when a request is accepted", async () => {
    const request = await prisma.relationshipRequest.create({
      data: {
        fromUserId: declarer.id,
        toUserId: counterpart.id,
        proposedType: "WORKED_WITH",
        intent: "WANT_TO_COLLABORATE",
      },
    });

    const { relationship } = await respondToRelationshipRequest(request.id, counterpart.id, true);

    expect(relationship).toBeDefined();
    expect(relationship!.confirmationStatus).toBe("SELF_DECLARED");
    expect(relationship!.declaredByUserId).toBe(declarer.id);
  });

  it("refuses to let the declaring party confirm their own declaration", async () => {
    const relationship = await prisma.relationship.findFirstOrThrow({
      where: { partyAUserId: declarer.id, partyBUserId: counterpart.id, type: "WORKED_WITH" },
    });

    await expect(confirmRelationship(relationship.id, declarer.id)).rejects.toBeInstanceOf(
      RelationshipAuthError,
    );

    const unchanged = await prisma.relationship.findUniqueOrThrow({ where: { id: relationship.id } });
    expect(unchanged.confirmationStatus).toBe("SELF_DECLARED");
  });

  it("lets the counterpart confirm, flipping status to MUTUALLY_CONFIRMED", async () => {
    const relationship = await prisma.relationship.findFirstOrThrow({
      where: { partyAUserId: declarer.id, partyBUserId: counterpart.id, type: "WORKED_WITH" },
    });

    const confirmed = await confirmRelationship(relationship.id, counterpart.id);
    expect(confirmed.confirmationStatus).toBe("MUTUALLY_CONFIRMED");
  });

  it("only updates the acting participant's own visibility row", async () => {
    const relationship = await prisma.relationship.findFirstOrThrow({
      where: { partyAUserId: declarer.id, partyBUserId: counterpart.id, type: "WORKED_WITH" },
    });

    await setParticipantVisibility(relationship.id, counterpart.id, "PRIVATE", false);

    const declarerVisibility = await prisma.relationshipParticipantVisibility.findUnique({
      where: { relationshipId_userId: { relationshipId: relationship.id, userId: declarer.id } },
    });
    const counterpartVisibility = await prisma.relationshipParticipantVisibility.findUnique({
      where: { relationshipId_userId: { relationshipId: relationship.id, userId: counterpart.id } },
    });

    expect(counterpartVisibility?.visibility).toBe("PRIVATE");
    expect(declarerVisibility?.visibility).toBe("PUBLIC");
  });

  it("marks an endorsement UNVERIFIED on a self-declared relationship, VERIFIED once mutually confirmed", async () => {
    const selfDeclaredRequest = await prisma.relationshipRequest.create({
      data: {
        fromUserId: declarer.id,
        toUserId: counterpart.id,
        proposedType: "COLLABORATOR",
        intent: "WANT_TO_COLLABORATE",
      },
    });
    const { relationship: stillSelfDeclared } = await respondToRelationshipRequest(
      selfDeclaredRequest.id,
      counterpart.id,
      true,
    );

    const unverified = await createEndorsement({
      endorserUserId: counterpart.id,
      subjectUserId: declarer.id,
      skillId,
      relationshipId: stillSelfDeclared!.id,
    });
    expect(unverified.status).toBe("UNVERIFIED");

    await confirmRelationship(stillSelfDeclared!.id, counterpart.id);

    const otherSkill = await prisma.skill.create({
      data: { slug: `test-skill-2-${RUN_ID}`, name: `Test skill 2 ${RUN_ID}`, categoryGroup: "OTHER" },
    });
    const verified = await createEndorsement({
      endorserUserId: counterpart.id,
      subjectUserId: declarer.id,
      skillId: otherSkill.id,
      relationshipId: stillSelfDeclared!.id,
    });
    expect(verified.status).toBe("VERIFIED");
  });
});
