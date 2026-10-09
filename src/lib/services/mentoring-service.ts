import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/services/notification-service";
import { respondToRelationshipRequest } from "@/lib/services/relationship-service";
import type { MentoringFormat } from "@prisma/client";

/**
 * A discoverable, *mutual* mentoring marketplace — distinct from the existing one-sided
 * `LEARNING_FROM` relationship declaration, which stays exactly as-is (self-declared,
 * author-hideable, never implying agreement; see docs/product-overview.md principle 8).
 * This is the mutual counterpart the product-expansion plan asks for, not a replacement.
 *
 * Accepting a MentoringRequest reuses the existing relationship-request machinery
 * (relationship-service.ts) rather than inventing a parallel "connected" concept: the
 * mentee's ask becomes a SELF_DECLARED MENTOR_MENTEE Relationship the moment the mentor
 * accepts, and — same as every other relationship in this app — actually confirming
 * that mentoring happened still requires the other party (here, the mentor, since the
 * mentee is `declaredByUserId`) to call confirmRelationship() separately. Accepting a
 * request is not the same thing as confirming it happened.
 */

// Local error classes rather than importing src/lib/auth-helpers's ForbiddenError —
// that module pulls in next-auth (src/lib/auth.ts), which doesn't resolve under the
// plain-node Vitest environment this service's tests run in (same reason
// relationship-service.ts defines its own RelationshipAuthError/RelationshipStateError
// instead of reusing ForbiddenError). Route handlers still map these to 403s.
export class MentoringAuthError extends Error {}
export class MentoringCapacityError extends Error {}

export async function listMentoringOffers(filters: { skillId?: string; format?: MentoringFormat }) {
  return prisma.mentoringOffer.findMany({
    where: {
      isActive: true,
      ...(filters.skillId ? { skillId: filters.skillId } : {}),
      ...(filters.format ? { format: filters.format } : {}),
    },
    include: {
      skill: true,
      mentor: {
        select: {
          id: true,
          name: true,
          personProfile: { select: { slug: true, displayName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Includes the mentor's system-assigned stage on this specific skill (if set) so the UI
 * can show it neutrally — "Learning"/"Emerging"/"Practicing"/"Established" is evidence,
 * not a ranking of who's a more worthy mentor. Peer mentoring from an Emerging/Learning
 * mentor is a legitimate offer, not a lesser one.
 */
export async function getMentoringOffer(id: string) {
  const offer = await prisma.mentoringOffer.findUnique({
    where: { id },
    include: {
      skill: true,
      mentor: {
        select: {
          id: true,
          name: true,
          personProfile: { select: { slug: true, displayName: true } },
        },
      },
    },
  });
  if (!offer) return null;

  const mentorSkill = await prisma.personSkill.findFirst({
    where: { skillId: offer.skillId, personProfile: { userId: offer.mentorUserId } },
    select: { stage: true },
  });

  return { ...offer, mentorStage: mentorSkill?.stage ?? null };
}

export async function listMyMentoringOffers(userId: string) {
  return prisma.mentoringOffer.findMany({
    where: { mentorUserId: userId },
    include: { skill: true, _count: { select: { requests: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMentoringOffer(
  mentorUserId: string,
  input: {
    skillId: string;
    title: string;
    description: string;
    format?: MentoringFormat;
    capacity?: number;
  },
) {
  return prisma.mentoringOffer.create({
    data: {
      mentorUserId,
      skillId: input.skillId,
      title: input.title,
      description: input.description,
      format: input.format ?? "ONE_ON_ONE",
      capacity: input.capacity ?? 1,
    },
  });
}

async function assertOwnsOffer(offerId: string, userId: string) {
  const offer = await prisma.mentoringOffer.findUniqueOrThrow({ where: { id: offerId } });
  if (offer.mentorUserId !== userId) throw new MentoringAuthError("You don't own this mentoring offer");
  return offer;
}

export async function updateMentoringOffer(
  offerId: string,
  userId: string,
  input: Partial<{
    title: string;
    description: string;
    format: MentoringFormat;
    capacity: number;
    isActive: boolean;
  }>,
) {
  await assertOwnsOffer(offerId, userId);
  return prisma.mentoringOffer.update({ where: { id: offerId }, data: input });
}

async function acceptedRequestCount(offerId: string): Promise<number> {
  return prisma.mentoringRequest.count({ where: { offerId, status: "ACCEPTED" } });
}

export async function requestMentoring(offerId: string, menteeUserId: string, message?: string) {
  const offer = await prisma.mentoringOffer.findUniqueOrThrow({ where: { id: offerId } });
  if (!offer.isActive) throw new MentoringAuthError("This mentoring offer is no longer active");
  if (offer.mentorUserId === menteeUserId) {
    throw new MentoringAuthError("You can't request mentoring from your own offer");
  }

  const existing = await prisma.mentoringRequest.findFirst({
    where: { offerId, menteeUserId, status: { in: ["PENDING", "ACCEPTED"] } },
  });
  if (existing) throw new MentoringAuthError("You already have an open request on this offer");

  const request = await prisma.mentoringRequest.create({
    data: { offerId, menteeUserId, message },
  });
  await notify(offer.mentorUserId, "MENTORING_REQUEST_RECEIVED", {
    offerId,
    requestId: request.id,
    menteeUserId,
  });
  return request;
}

export async function listRequestsForOffer(offerId: string, userId: string) {
  await assertOwnsOffer(offerId, userId);
  return prisma.mentoringRequest.findMany({
    where: { offerId },
    include: {
      mentee: {
        select: { id: true, name: true, personProfile: { select: { slug: true, displayName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listMyMentoringRequests(userId: string) {
  return prisma.mentoringRequest.findMany({
    where: { menteeUserId: userId },
    include: {
      offer: { include: { skill: true, mentor: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function acceptMentoringRequest(requestId: string, mentorUserId: string) {
  const request = await prisma.mentoringRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { offer: true },
  });
  if (request.offer.mentorUserId !== mentorUserId) {
    throw new MentoringAuthError("Only the mentor who owns this offer can accept requests");
  }
  if (request.status !== "PENDING") {
    throw new MentoringAuthError("This request has already been resolved");
  }

  const acceptedCount = await acceptedRequestCount(request.offerId);
  if (acceptedCount >= request.offer.capacity) {
    throw new MentoringCapacityError("This mentoring offer is already at capacity");
  }

  // Route through the existing relationship-request flow so the resulting relationship
  // inherits every invariant that machinery already enforces (role labels, default
  // visibility rows, SELF_DECLARED-until-countersigned semantics) rather than duplicating
  // it here.
  const relationshipRequest = await prisma.relationshipRequest.create({
    data: {
      fromUserId: request.menteeUserId,
      toUserId: mentorUserId,
      proposedType: "MENTOR_MENTEE",
      intent: "SEEK_MENTORSHIP",
      message: request.message ?? undefined,
    },
  });
  const { relationship } = await respondToRelationshipRequest(relationshipRequest.id, mentorUserId, true);

  const updated = await prisma.mentoringRequest.update({
    where: { id: requestId },
    data: {
      status: "ACCEPTED",
      respondedAt: new Date(),
      resultingRelationshipId: relationship?.id,
    },
  });

  await logAudit({
    actorUserId: mentorUserId,
    action: "mentoring.request.accept",
    targetType: "MentoringRequest",
    targetId: requestId,
    metadata: { relationshipId: relationship?.id },
  });
  await notify(request.menteeUserId, "MENTORING_REQUEST_DECISION", {
    requestId,
    offerId: request.offerId,
    accepted: true,
  });

  return updated;
}

export async function declineMentoringRequest(requestId: string, mentorUserId: string) {
  const request = await prisma.mentoringRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { offer: true },
  });
  if (request.offer.mentorUserId !== mentorUserId) {
    throw new MentoringAuthError("Only the mentor who owns this offer can decline requests");
  }
  if (request.status !== "PENDING") {
    throw new MentoringAuthError("This request has already been resolved");
  }

  const updated = await prisma.mentoringRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
  await notify(request.menteeUserId, "MENTORING_REQUEST_DECISION", {
    requestId,
    offerId: request.offerId,
    accepted: false,
  });
  return updated;
}

export async function withdrawMentoringRequest(requestId: string, menteeUserId: string) {
  const request = await prisma.mentoringRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.menteeUserId !== menteeUserId) throw new MentoringAuthError("Not your request");
  if (request.status !== "PENDING") throw new MentoringAuthError("This request has already been resolved");

  return prisma.mentoringRequest.update({
    where: { id: requestId },
    data: { status: "WITHDRAWN", respondedAt: new Date() },
  });
}
