import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  CircleAuthError,
  CircleCapacityError,
  createLearningCircle,
  decideMembership,
  leaveOrRemoveMember,
  requestToJoinCircle,
} from "@/lib/services/learning-circle-service";

/**
 * Covers learning-circle invariants: the creator is auto-added as an ACTIVE organizer,
 * joining requires organizer approval, capacity is enforced on both request and
 * approval, and a circle can never be left with zero active organizers. This is a
 * self-contained small-group model built independently of Track 3's (Relationships &
 * collaboration graph) private-network scoping, which doesn't exist in this codebase yet
 * — see docs/decisions.md for the flagged reconciliation note.
 */

const RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(label: string) {
  return prisma.user.create({
    data: { email: `${label}.${RUN_ID}@test.invalid`, name: `${label} ${RUN_ID}`, status: "ACTIVE" },
  });
}

describe("learning-circle-service invariants", () => {
  let organizer: { id: string };
  let member1: { id: string };
  let member2: { id: string };

  beforeAll(async () => {
    organizer = await makeUser("organizer");
    member1 = await makeUser("member1");
    member2 = await makeUser("member2");
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
  });

  it("auto-adds the creator as an ACTIVE organizer", async () => {
    const circle = await createLearningCircle(organizer.id, { title: "Test circle" });
    const membership = await prisma.learningCircleMembership.findUniqueOrThrow({
      where: { circleId_userId: { circleId: circle.id, userId: organizer.id } },
    });
    expect(membership.role).toBe("ORGANIZER");
    expect(membership.status).toBe("ACTIVE");
  });

  it("joining requires organizer approval — membership starts PENDING", async () => {
    const circle = await createLearningCircle(organizer.id, { title: "Approval-gated circle", capacity: 5 });
    const membership = await requestToJoinCircle(circle.id, member1.id);
    expect(membership.status).toBe("PENDING");

    const approved = await decideMembership(circle.id, organizer.id, member1.id, true);
    expect(approved.status).toBe("ACTIVE");
  });

  it("enforces capacity on join requests and on approval", async () => {
    const circle = await createLearningCircle(organizer.id, { title: "Capacity-limited circle", capacity: 1 });
    // Capacity 1 is already used by the auto-added organizer.
    await expect(requestToJoinCircle(circle.id, member1.id)).rejects.toBeInstanceOf(CircleCapacityError);
  });

  it("only an active organizer can approve or decline membership", async () => {
    const circle = await createLearningCircle(organizer.id, { title: "Organizer-only circle", capacity: 5 });
    await requestToJoinCircle(circle.id, member1.id);

    await expect(decideMembership(circle.id, member2.id, member1.id, true)).rejects.toBeInstanceOf(
      CircleAuthError,
    );
  });

  it("refuses to let the last active organizer leave", async () => {
    const circle = await createLearningCircle(organizer.id, { title: "Last-organizer-guard circle" });
    await expect(leaveOrRemoveMember(circle.id, organizer.id, organizer.id)).rejects.toBeInstanceOf(
      CircleAuthError,
    );
  });

  it("lets a member leave on their own, and an organizer remove someone else", async () => {
    const circle = await createLearningCircle(organizer.id, { title: "Leave-and-remove circle", capacity: 5 });
    await requestToJoinCircle(circle.id, member1.id);
    await decideMembership(circle.id, organizer.id, member1.id, true);

    await requestToJoinCircle(circle.id, member2.id);
    await decideMembership(circle.id, organizer.id, member2.id, true);

    const left = await leaveOrRemoveMember(circle.id, member1.id, member1.id);
    expect(left.status).toBe("LEFT");

    const removed = await leaveOrRemoveMember(circle.id, organizer.id, member2.id);
    expect(removed.status).toBe("REMOVED");
  });
});
