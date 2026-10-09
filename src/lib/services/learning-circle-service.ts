import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/services/notification-service";
import type { GeoScope } from "@prisma/client";

/**
 * Small-group learning circles. Deliberately self-contained — its own membership model,
 * not a reuse of Track 3's (Relationships & collaboration graph) private-network
 * scoping, which is being built concurrently and doesn't exist in this codebase yet.
 * Flagged for reconciliation during integration; see docs/decisions.md.
 */

// Local error classes rather than importing src/lib/auth-helpers's ForbiddenError —
// see the same note in mentoring-service.ts for why.
export class CircleAuthError extends Error {}
export class CircleCapacityError extends Error {}

export async function listLearningCircles(filters: { skillId?: string; geoScope?: GeoScope }) {
  return prisma.learningCircle.findMany({
    where: {
      isActive: true,
      ...(filters.skillId ? { skillId: filters.skillId } : {}),
      ...(filters.geoScope ? { geoScope: filters.geoScope } : {}),
    },
    include: {
      skill: true,
      creator: { select: { name: true } },
      _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLearningCircle(id: string) {
  return prisma.learningCircle.findUnique({
    where: { id },
    include: {
      skill: true,
      creator: { select: { id: true, name: true } },
      memberships: {
        where: { status: { in: ["ACTIVE", "PENDING"] } },
        include: {
          user: { select: { id: true, name: true, personProfile: { select: { slug: true } } } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
}

export async function listMyCircles(userId: string) {
  return prisma.learningCircleMembership.findMany({
    where: { userId, status: { in: ["ACTIVE", "PENDING"] } },
    include: { circle: { include: { skill: true } } },
    orderBy: { joinedAt: "desc" },
  });
}

export async function createLearningCircle(
  creatorUserId: string,
  input: { title: string; description?: string; skillId?: string; capacity?: number; geoScope?: GeoScope },
) {
  return prisma.$transaction(async (tx) => {
    const circle = await tx.learningCircle.create({
      data: {
        creatorUserId,
        title: input.title,
        description: input.description,
        skillId: input.skillId,
        capacity: input.capacity ?? 8,
        geoScope: input.geoScope ?? "LOCAL",
      },
    });
    await tx.learningCircleMembership.create({
      data: { circleId: circle.id, userId: creatorUserId, role: "ORGANIZER", status: "ACTIVE" },
    });
    return circle;
  });
}

async function activeMemberCount(circleId: string): Promise<number> {
  return prisma.learningCircleMembership.count({ where: { circleId, status: "ACTIVE" } });
}

export async function requestToJoinCircle(circleId: string, userId: string) {
  const circle = await prisma.learningCircle.findUniqueOrThrow({ where: { id: circleId } });
  if (!circle.isActive) throw new CircleAuthError("This learning circle isn't accepting new members");

  const existing = await prisma.learningCircleMembership.findUnique({
    where: { circleId_userId: { circleId, userId } },
  });
  if (existing && (existing.status === "ACTIVE" || existing.status === "PENDING")) {
    throw new CircleAuthError("You already have a membership request for this circle");
  }

  const activeCount = await activeMemberCount(circleId);
  if (activeCount >= circle.capacity) throw new CircleCapacityError("This learning circle is full");

  const membership = existing
    ? await prisma.learningCircleMembership.update({
        where: { id: existing.id },
        data: { status: "PENDING", joinedAt: new Date() },
      })
    : await prisma.learningCircleMembership.create({
        data: { circleId, userId, status: "PENDING" },
      });

  await notify(circle.creatorUserId, "LEARNING_CIRCLE_JOIN_REQUEST", { circleId, userId });
  return membership;
}

async function assertActiveOrganizer(circleId: string, userId: string) {
  const membership = await prisma.learningCircleMembership.findUnique({
    where: { circleId_userId: { circleId, userId } },
  });
  if (!membership || membership.role !== "ORGANIZER" || membership.status !== "ACTIVE") {
    throw new CircleAuthError("Only an active organizer can manage this circle's membership");
  }
}

export async function decideMembership(
  circleId: string,
  organizerUserId: string,
  targetUserId: string,
  approve: boolean,
) {
  await assertActiveOrganizer(circleId, organizerUserId);
  const circle = await prisma.learningCircle.findUniqueOrThrow({ where: { id: circleId } });
  const membership = await prisma.learningCircleMembership.findUniqueOrThrow({
    where: { circleId_userId: { circleId, userId: targetUserId } },
  });
  if (membership.status !== "PENDING") throw new CircleAuthError("This request has already been resolved");

  if (approve) {
    const activeCount = await activeMemberCount(circleId);
    if (activeCount >= circle.capacity) throw new CircleCapacityError("This learning circle is full");
  }

  const updated = await prisma.learningCircleMembership.update({
    where: { circleId_userId: { circleId, userId: targetUserId } },
    data: { status: approve ? "ACTIVE" : "REMOVED" },
  });
  await notify(targetUserId, "LEARNING_CIRCLE_MEMBERSHIP_DECISION", { circleId, approved: approve });
  return updated;
}

export async function leaveOrRemoveMember(circleId: string, actingUserId: string, targetUserId: string) {
  if (actingUserId !== targetUserId) {
    await assertActiveOrganizer(circleId, actingUserId);
  }
  const membership = await prisma.learningCircleMembership.findUniqueOrThrow({
    where: { circleId_userId: { circleId, userId: targetUserId } },
  });

  if (membership.role === "ORGANIZER" && membership.status === "ACTIVE") {
    const otherActiveOrganizers = await prisma.learningCircleMembership.count({
      where: { circleId, role: "ORGANIZER", status: "ACTIVE", userId: { not: targetUserId } },
    });
    if (otherActiveOrganizers === 0) {
      throw new CircleAuthError("Assign another organizer before this one leaves — a circle needs at least one");
    }
  }

  return prisma.learningCircleMembership.update({
    where: { circleId_userId: { circleId, userId: targetUserId } },
    data: { status: actingUserId === targetUserId ? "LEFT" : "REMOVED" },
  });
}
