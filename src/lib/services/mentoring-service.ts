import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

/**
 * Structured mentoring programs (Track 3 — relationships & collaboration graph, see
 * docs/roadmap/03-relationships-and-collaboration.md). Distinct from both the generic
 * MENTOR_MENTEE Relationship type and the one-sided LEARNING_FROM declaration: a
 * program is a mutual proposal with its own lifecycle
 * (PROPOSED -> ACTIVE -> COMPLETED/DECLINED/CANCELLED).
 *
 * Deliberately does NOT auto-create or auto-confirm a Relationship row on acceptance —
 * doing so would be a second, looser path to "mutually confirmed" alongside
 * confirmRelationship()'s declare-then-counterpart-confirms flow, which would blur the
 * single most load-bearing invariant in the app (see docs/data-model.md invariant #1).
 * `relationshipId` is purely an optional cross-link for when the two people separately
 * hold a Relationship they want this program associated with — this track lands the
 * core construct; a mentorship marketplace/session-scheduling UI on top of it is
 * Learning & mentorship (Track 5)'s scope, not built here.
 */

export class MentoringAuthError extends Error {}
export class MentoringStateError extends Error {}

function assertParty(program: { mentorUserId: string; menteeUserId: string }, userId: string, verb: string) {
  if (program.mentorUserId !== userId && program.menteeUserId !== userId) {
    throw new MentoringAuthError(`Only the mentor or mentee can ${verb} this program`);
  }
}

export async function proposeMentoringProgram(input: {
  proposedByUserId: string;
  mentorUserId: string;
  menteeUserId: string;
  title: string;
  description?: string;
  focusSkillId?: string;
  goals?: Prisma.InputJsonValue;
  relationshipId?: string;
}) {
  if (input.mentorUserId === input.menteeUserId) {
    throw new MentoringStateError("Mentor and mentee must be different people");
  }
  if (input.proposedByUserId !== input.mentorUserId && input.proposedByUserId !== input.menteeUserId) {
    throw new MentoringAuthError("Only the prospective mentor or mentee can propose this program");
  }
  if (input.relationshipId) {
    const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: input.relationshipId } });
    const parties = new Set([rel.partyAUserId, rel.partyBUserId]);
    if (!parties.has(input.mentorUserId) || !parties.has(input.menteeUserId)) {
      throw new MentoringStateError("The linked relationship must involve both the mentor and the mentee");
    }
  }

  return prisma.mentoringProgram.create({
    data: {
      mentorUserId: input.mentorUserId,
      menteeUserId: input.menteeUserId,
      proposedByUserId: input.proposedByUserId,
      title: input.title,
      description: input.description,
      focusSkillId: input.focusSkillId,
      goals: input.goals,
      relationshipId: input.relationshipId,
      status: "PROPOSED",
    },
  });
}

/**
 * The proposer can never be the one who accepts/declines their own proposal — same
 * declarer-cannot-confirm shape as confirmRelationship().
 */
export async function respondToMentoringProgram(programId: string, respondingUserId: string, accept: boolean) {
  const program = await prisma.mentoringProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.status !== "PROPOSED") throw new MentoringStateError("This program has already been responded to");
  if (program.proposedByUserId === respondingUserId) {
    throw new MentoringAuthError("The proposer cannot respond to their own proposal");
  }
  assertParty(program, respondingUserId, "respond to");

  const updated = await prisma.mentoringProgram.update({
    where: { id: programId },
    data: accept
      ? { status: "ACTIVE", respondedAt: new Date(), startDate: new Date() }
      : { status: "DECLINED", respondedAt: new Date() },
  });
  await logAudit({
    actorUserId: respondingUserId,
    action: accept ? "mentoring_program.accept" : "mentoring_program.decline",
    targetType: "MentoringProgram",
    targetId: programId,
  });
  return updated;
}

export async function completeMentoringProgram(programId: string, actingUserId: string) {
  const program = await prisma.mentoringProgram.findUniqueOrThrow({ where: { id: programId } });
  assertParty(program, actingUserId, "complete");
  if (program.status !== "ACTIVE") throw new MentoringStateError("Only an active program can be marked complete");
  return prisma.mentoringProgram.update({ where: { id: programId }, data: { status: "COMPLETED", endDate: new Date() } });
}

export async function cancelMentoringProgram(programId: string, actingUserId: string) {
  const program = await prisma.mentoringProgram.findUniqueOrThrow({ where: { id: programId } });
  assertParty(program, actingUserId, "cancel");
  if (program.status !== "ACTIVE" && program.status !== "PROPOSED") {
    throw new MentoringStateError("This program has already finished");
  }
  return prisma.mentoringProgram.update({ where: { id: programId }, data: { status: "CANCELLED", endDate: new Date() } });
}

export async function listMyMentoringPrograms(userId: string) {
  return prisma.mentoringProgram.findMany({
    where: { OR: [{ mentorUserId: userId }, { menteeUserId: userId }] },
    include: {
      mentor: { select: { id: true, name: true } },
      mentee: { select: { id: true, name: true } },
      focusSkill: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMentoringProgramDetail(programId: string, viewerUserId: string) {
  const program = await prisma.mentoringProgram.findUnique({
    where: { id: programId },
    include: {
      mentor: { select: { id: true, name: true } },
      mentee: { select: { id: true, name: true } },
      focusSkill: true,
    },
  });
  if (!program) return null;
  assertParty(program, viewerUserId, "view");
  return program;
}
