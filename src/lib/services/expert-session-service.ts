import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/services/notification-service";
import type { GeoScope, LocationType } from "@prisma/client";

/**
 * Bookable, time-boxed expert sessions. No payment processing in this track (see
 * docs/roadmap/05-learning-and-mentorship.md) — booking is just a capacity-checked
 * reservation. Deliberately independent of PersonProfile.availability (a coarse status
 * flag, not a schedule) — see the flagged policy question in docs/decisions.md.
 */

// Local error classes rather than importing src/lib/auth-helpers's ForbiddenError —
// see the same note in mentoring-service.ts for why.
export class SessionAuthError extends Error {}
export class SessionCapacityError extends Error {}

export async function listExpertSessions(filters: { skillId?: string; upcomingOnly?: boolean }) {
  return prisma.expertSession.findMany({
    where: {
      status: "SCHEDULED",
      ...(filters.skillId ? { skillId: filters.skillId } : {}),
      ...(filters.upcomingOnly ? { startsAt: { gte: new Date() } } : {}),
    },
    include: {
      skill: true,
      host: {
        select: { id: true, name: true, personProfile: { select: { slug: true, displayName: true } } },
      },
      _count: { select: { bookings: { where: { status: "BOOKED" } } } },
    },
    orderBy: { startsAt: "asc" },
  });
}

export async function getExpertSession(id: string) {
  return prisma.expertSession.findUnique({
    where: { id },
    include: {
      skill: true,
      host: {
        select: { id: true, name: true, personProfile: { select: { slug: true, displayName: true } } },
      },
      bookings: {
        where: { status: "BOOKED" },
        include: { attendee: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function listMyHostedSessions(userId: string) {
  return prisma.expertSession.findMany({
    where: { hostUserId: userId },
    include: { skill: true, _count: { select: { bookings: { where: { status: "BOOKED" } } } } },
    orderBy: { startsAt: "desc" },
  });
}

export async function listMyBookings(userId: string) {
  return prisma.expertSessionBooking.findMany({
    where: { attendeeUserId: userId, status: "BOOKED" },
    include: { session: { include: { skill: true, host: { select: { name: true } } } } },
    orderBy: { session: { startsAt: "asc" } },
  });
}

export async function createExpertSession(
  hostUserId: string,
  input: {
    skillId?: string;
    mentoringOfferId?: string;
    title: string;
    description?: string;
    startsAt: Date;
    endsAt: Date;
    capacity?: number;
    locationType?: LocationType;
    geoScope?: GeoScope;
    locationNote?: string;
  },
) {
  if (input.endsAt <= input.startsAt) {
    throw new SessionAuthError("A session must end after it starts");
  }
  if (input.mentoringOfferId) {
    const offer = await prisma.mentoringOffer.findUniqueOrThrow({ where: { id: input.mentoringOfferId } });
    if (offer.mentorUserId !== hostUserId) throw new SessionAuthError("You don't own that mentoring offer");
  }

  return prisma.expertSession.create({
    data: {
      hostUserId,
      skillId: input.skillId,
      mentoringOfferId: input.mentoringOfferId,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity ?? 1,
      locationType: input.locationType ?? "REMOTE",
      geoScope: input.geoScope ?? "GLOBAL",
      locationNote: input.locationNote,
    },
  });
}

async function assertHosts(sessionId: string, userId: string) {
  const session = await prisma.expertSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.hostUserId !== userId) throw new SessionAuthError("Only the host can manage this session");
  return session;
}

export async function cancelExpertSession(sessionId: string, userId: string) {
  const session = await assertHosts(sessionId, userId);
  const bookings = await prisma.expertSessionBooking.findMany({
    where: { sessionId, status: "BOOKED" },
  });

  const updated = await prisma.expertSession.update({
    where: { id: sessionId },
    data: { status: "CANCELLED" },
  });
  await prisma.expertSessionBooking.updateMany({
    where: { sessionId, status: "BOOKED" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await Promise.all(
    bookings.map((b) =>
      notify(b.attendeeUserId, "EXPERT_SESSION_CANCELLED", { sessionId, title: session.title }),
    ),
  );
  return updated;
}

export async function bookExpertSession(sessionId: string, attendeeUserId: string) {
  const session = await prisma.expertSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.status !== "SCHEDULED") throw new SessionAuthError("This session isn't open for booking");
  if (session.hostUserId === attendeeUserId) throw new SessionAuthError("You can't book your own session");

  const existing = await prisma.expertSessionBooking.findUnique({
    where: { sessionId_attendeeUserId: { sessionId, attendeeUserId } },
  });
  if (existing?.status === "BOOKED") throw new SessionAuthError("You already booked this session");

  const bookedCount = await prisma.expertSessionBooking.count({
    where: { sessionId, status: "BOOKED" },
  });
  if (bookedCount >= session.capacity) {
    throw new SessionCapacityError("This session is fully booked");
  }

  const booking = existing
    ? await prisma.expertSessionBooking.update({
        where: { id: existing.id },
        data: { status: "BOOKED", cancelledAt: null },
      })
    : await prisma.expertSessionBooking.create({
        data: { sessionId, attendeeUserId, status: "BOOKED" },
      });

  await notify(session.hostUserId, "EXPERT_SESSION_BOOKED", { sessionId, attendeeUserId });
  return booking;
}

export async function cancelBooking(sessionId: string, attendeeUserId: string) {
  const booking = await prisma.expertSessionBooking.findUniqueOrThrow({
    where: { sessionId_attendeeUserId: { sessionId, attendeeUserId } },
  });
  if (booking.attendeeUserId !== attendeeUserId) throw new SessionAuthError("Not your booking");

  return prisma.expertSessionBooking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}
