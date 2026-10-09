import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  MentoringAuthError,
  MentoringCapacityError,
  acceptMentoringRequest,
  createMentoringOffer,
  declineMentoringRequest,
  requestMentoring,
} from "@/lib/services/mentoring-service";
import { confirmRelationship, RelationshipAuthError } from "@/lib/services/relationship-service";

/**
 * Covers the invariants specific to this track (see docs/roadmap/05-learning-and-mentorship.md):
 * - MentoringOffer/MentoringRequest is a genuinely separate, mutual construct — it does
 *   not silently replace the one-sided LEARNING_FROM declaration.
 * - Accepting a request is capacity-checked and reuses the existing relationship-request
 *   machinery, so the resulting Relationship inherits the same SELF_DECLARED-until-
 *   countersigned invariant as every other relationship in the app: the mentee's request
 *   is what's self-declared, and the mentor accepting it is not the same as the mentor
 *   later confirming mentoring actually happened.
 * Runs against a real local Postgres (see docs/testing.md) using throwaway users this
 * file creates and tears down itself.
 */

const RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(label: string) {
  return prisma.user.create({
    data: { email: `${label}.${RUN_ID}@test.invalid`, name: `${label} ${RUN_ID}`, status: "ACTIVE" },
  });
}

describe("mentoring-service invariants", () => {
  let mentor: { id: string };
  let mentee1: { id: string };
  let mentee2: { id: string };
  let skillId: string;

  beforeAll(async () => {
    mentor = await makeUser("mentor");
    mentee1 = await makeUser("mentee1");
    mentee2 = await makeUser("mentee2");
    const skill = await prisma.skill.create({
      data: { slug: `test-skill-${RUN_ID}`, name: `Test skill ${RUN_ID}`, categoryGroup: "OTHER" },
    });
    skillId = skill.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
    await prisma.skill.deleteMany({ where: { slug: { contains: RUN_ID } } });
  });

  it("accepting a mentoring request creates a SELF_DECLARED MENTOR_MENTEE relationship declared by the mentee", async () => {
    const offer = await createMentoringOffer(mentor.id, {
      skillId,
      title: "Mentoring offer",
      description: "Happy to help",
      capacity: 1,
    });

    const request = await requestMentoring(offer.id, mentee1.id, "Please mentor me");
    const accepted = await acceptMentoringRequest(request.id, mentor.id);

    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.resultingRelationshipId).toBeTruthy();

    const relationship = await prisma.relationship.findUniqueOrThrow({
      where: { id: accepted.resultingRelationshipId! },
    });
    expect(relationship.type).toBe("MENTOR_MENTEE");
    expect(relationship.confirmationStatus).toBe("SELF_DECLARED");
    expect(relationship.declaredByUserId).toBe(mentee1.id);

    // Same invariant as every other relationship: the declarer (here, the mentee) can't
    // confirm their own declaration — only the mentor (the counterpart) can.
    await expect(confirmRelationship(relationship.id, mentee1.id)).rejects.toBeInstanceOf(
      RelationshipAuthError,
    );
    const confirmed = await confirmRelationship(relationship.id, mentor.id);
    expect(confirmed.confirmationStatus).toBe("MUTUALLY_CONFIRMED");
  });

  it("enforces offer capacity — a second ACCEPTED request beyond capacity is rejected", async () => {
    const offer = await createMentoringOffer(mentor.id, {
      skillId,
      title: "Capacity-limited offer",
      description: "Only room for one mentee",
      capacity: 1,
    });

    const firstRequest = await requestMentoring(offer.id, mentee1.id);
    await acceptMentoringRequest(firstRequest.id, mentor.id);

    const secondRequest = await requestMentoring(offer.id, mentee2.id);
    await expect(acceptMentoringRequest(secondRequest.id, mentor.id)).rejects.toBeInstanceOf(
      MentoringCapacityError,
    );
  });

  it("prevents a second open request from the same mentee on the same offer", async () => {
    const offer = await createMentoringOffer(mentor.id, {
      skillId,
      title: "Duplicate-request offer",
      description: "Testing duplicate guard",
      capacity: 5,
    });

    await requestMentoring(offer.id, mentee1.id);
    await expect(requestMentoring(offer.id, mentee1.id)).rejects.toBeInstanceOf(MentoringAuthError);
  });

  it("only the owning mentor can accept or decline a request", async () => {
    const offer = await createMentoringOffer(mentor.id, {
      skillId,
      title: "Ownership-checked offer",
      description: "Testing ownership guard",
      capacity: 5,
    });
    const request = await requestMentoring(offer.id, mentee1.id);

    await expect(acceptMentoringRequest(request.id, mentee2.id)).rejects.toBeInstanceOf(MentoringAuthError);
    await expect(declineMentoringRequest(request.id, mentee2.id)).rejects.toBeInstanceOf(MentoringAuthError);

    const declined = await declineMentoringRequest(request.id, mentor.id);
    expect(declined.status).toBe("DECLINED");
  });
});
