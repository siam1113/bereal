import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  SessionAuthError,
  SessionCapacityError,
  bookExpertSession,
  cancelExpertSession,
  createExpertSession,
} from "@/lib/services/expert-session-service";

/**
 * Covers expert-session invariants: no payment processing (booking is purely a
 * capacity-checked reservation), capacity is enforced, a host can't book their own
 * session, and cancelling a session cancels every active booking on it. Runs against a
 * real local Postgres (see docs/testing.md) using throwaway users this file creates and
 * tears down itself.
 */

const RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(label: string) {
  return prisma.user.create({
    data: { email: `${label}.${RUN_ID}@test.invalid`, name: `${label} ${RUN_ID}`, status: "ACTIVE" },
  });
}

describe("expert-session-service invariants", () => {
  let host: { id: string };
  let attendee1: { id: string };
  let attendee2: { id: string };

  beforeAll(async () => {
    host = await makeUser("host");
    attendee1 = await makeUser("attendee1");
    attendee2 = await makeUser("attendee2");
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
  });

  function nextWeek(hoursFromNow: number) {
    return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  }

  it("enforces capacity — booking beyond capacity throws", async () => {
    const session = await createExpertSession(host.id, {
      title: "Capacity test session",
      startsAt: nextWeek(24),
      endsAt: nextWeek(25),
      capacity: 1,
    });

    await bookExpertSession(session.id, attendee1.id);
    await expect(bookExpertSession(session.id, attendee2.id)).rejects.toBeInstanceOf(SessionCapacityError);
  });

  it("refuses to let the host book their own session", async () => {
    const session = await createExpertSession(host.id, {
      title: "Host guard session",
      startsAt: nextWeek(26),
      endsAt: nextWeek(27),
      capacity: 5,
    });

    await expect(bookExpertSession(session.id, host.id)).rejects.toBeInstanceOf(SessionAuthError);
  });

  it("cancelling a session cancels every active booking on it", async () => {
    const session = await createExpertSession(host.id, {
      title: "Cancellation cascade session",
      startsAt: nextWeek(28),
      endsAt: nextWeek(29),
      capacity: 5,
    });
    await bookExpertSession(session.id, attendee1.id);
    await bookExpertSession(session.id, attendee2.id);

    await cancelExpertSession(session.id, host.id);

    const bookings = await prisma.expertSessionBooking.findMany({ where: { sessionId: session.id } });
    expect(bookings.every((b) => b.status === "CANCELLED")).toBe(true);

    // The session itself no longer accepts new bookings.
    const thirdAttendee = await makeUser("attendee3");
    await expect(bookExpertSession(session.id, thirdAttendee.id)).rejects.toBeInstanceOf(SessionAuthError);
  });

  it("only the host can cancel a session", async () => {
    const session = await createExpertSession(host.id, {
      title: "Ownership-checked session",
      startsAt: nextWeek(30),
      endsAt: nextWeek(31),
      capacity: 5,
    });

    await expect(cancelExpertSession(session.id, attendee1.id)).rejects.toBeInstanceOf(SessionAuthError);
  });
});
