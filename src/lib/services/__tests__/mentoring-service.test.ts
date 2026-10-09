import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  MentoringAuthError,
  MentoringStateError,
  cancelMentoringProgram,
  completeMentoringProgram,
  proposeMentoringProgram,
  respondToMentoringProgram,
} from "@/lib/services/mentoring-service";

/**
 * Covers Track 3's structured mentoring programs (see
 * docs/roadmap/03-relationships-and-collaboration.md): a mutual proposal with its own
 * lifecycle, kept deliberately separate from the generic Relationship graph — accepting
 * a program must never create or silently confirm a Relationship row (see
 * docs/data-model.md invariant #1, "confirmationStatus only advances via the
 * counterpart" — a program's own ACTIVE status is not that).
 */

const RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(label: string) {
  return prisma.user.create({
    data: { email: `${label}.${RUN_ID}@test.invalid`, name: `${label} ${RUN_ID}`, status: "ACTIVE" },
  });
}

describe("mentoring-service", () => {
  let mentor: { id: string };
  let mentee: { id: string };
  let stranger: { id: string };

  beforeAll(async () => {
    mentor = await makeUser("mentoring-mentor");
    mentee = await makeUser("mentoring-mentee");
    stranger = await makeUser("mentoring-stranger");
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
  });

  it("only lets the prospective mentor or mentee propose the program", async () => {
    await expect(
      proposeMentoringProgram({
        proposedByUserId: stranger.id,
        mentorUserId: mentor.id,
        menteeUserId: mentee.id,
        title: "Furniture finishing basics",
      }),
    ).rejects.toBeInstanceOf(MentoringAuthError);
  });

  it("refuses mentor === mentee", async () => {
    await expect(
      proposeMentoringProgram({
        proposedByUserId: mentor.id,
        mentorUserId: mentor.id,
        menteeUserId: mentor.id,
        title: "Self mentoring?",
      }),
    ).rejects.toBeInstanceOf(MentoringStateError);
  });

  it("creates a PROPOSED program, which the proposer can't accept/decline themselves", async () => {
    const program = await proposeMentoringProgram({
      proposedByUserId: mentee.id,
      mentorUserId: mentor.id,
      menteeUserId: mentee.id,
      title: "Furniture finishing basics",
      goals: ["Learn joinery", "Finish a sample piece"],
    });
    expect(program.status).toBe("PROPOSED");

    await expect(respondToMentoringProgram(program.id, mentee.id, true)).rejects.toBeInstanceOf(MentoringAuthError);

    const relationshipCountBefore = await prisma.relationship.count({
      where: { OR: [{ partyAUserId: mentor.id }, { partyBUserId: mentor.id }] },
    });

    const accepted = await respondToMentoringProgram(program.id, mentor.id, true);
    expect(accepted.status).toBe("ACTIVE");
    expect(accepted.startDate).not.toBeNull();

    // Accepting a program must never silently create a Relationship row.
    const relationshipCountAfter = await prisma.relationship.count({
      where: { OR: [{ partyAUserId: mentor.id }, { partyBUserId: mentor.id }] },
    });
    expect(relationshipCountAfter).toBe(relationshipCountBefore);
  });

  it("only lets mentor/mentee complete or cancel an active program", async () => {
    const program = await proposeMentoringProgram({
      proposedByUserId: mentor.id,
      mentorUserId: mentor.id,
      menteeUserId: mentee.id,
      title: "Advanced joinery",
    });
    await respondToMentoringProgram(program.id, mentee.id, true);

    await expect(completeMentoringProgram(program.id, stranger.id)).rejects.toBeInstanceOf(MentoringAuthError);

    const completed = await completeMentoringProgram(program.id, mentee.id);
    expect(completed.status).toBe("COMPLETED");

    await expect(cancelMentoringProgram(program.id, mentor.id)).rejects.toBeInstanceOf(MentoringStateError);
  });

  it("lets either party decline a proposal", async () => {
    const program = await proposeMentoringProgram({
      proposedByUserId: mentor.id,
      mentorUserId: mentor.id,
      menteeUserId: mentee.id,
      title: "Declined program",
    });
    const declined = await respondToMentoringProgram(program.id, mentee.id, false);
    expect(declined.status).toBe("DECLINED");
  });
});
