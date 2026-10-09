import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  OpportunitySlotCapacityError,
  OpportunityValidationError,
  applyToOpportunity,
  createOpportunity,
  getOpportunity,
  setApplicationStatus,
} from "@/lib/services/opportunity-service";

/**
 * Covers Track 4 (opportunity network) additions on top of V1's existing
 * help-requests/opportunities/services layer (see docs/roadmap/04-opportunity-network.md):
 *   - the pre-existing STANDARD opportunity apply/accept flow is unchanged (no
 *     regression of the non-negotiable "client can post, see matches, inquire" case)
 *   - a TEAM_PROJECT opportunity's team slots can't be exceeded when accepting
 *     applications (the team-formation invariant this track adds)
 *   - kind-specific inputs are validated against the opportunity's actual kind, not
 *     trusted blindly from the caller
 * Runs against a real local Postgres (see docs/testing.md) using throwaway users/skills
 * this file creates and tears down itself.
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

describe("opportunity-service — Track 4 additions", () => {
  let poster: { id: string };
  let applicantA: { id: string };
  let applicantB: { id: string };
  let applicantC: { id: string };
  let skillId: string;

  beforeAll(async () => {
    poster = await makeUser("poster");
    applicantA = await makeUser("applicant-a");
    applicantB = await makeUser("applicant-b");
    applicantC = await makeUser("applicant-c");
    const skill = await prisma.skill.create({
      data: { slug: `test-skill-${RUN_ID}`, name: `Test skill ${RUN_ID}`, categoryGroup: "OTHER" },
    });
    skillId = skill.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
    await prisma.skill.deleteMany({ where: { slug: { contains: RUN_ID } } });
  });

  it("still supports the existing STANDARD apply → accept flow unmodified", async () => {
    const opportunity = await createOpportunity(poster.id, {
      type: "TASK",
      title: `Standard task ${RUN_ID}`,
      description: "Fix a thing",
      locationType: "REMOTE",
      geoScope: "LOCAL",
    });
    expect(opportunity.kind).toBe("STANDARD");

    const application = await applyToOpportunity(opportunity.id, applicantA.id, { coverMessage: "I can help" });
    expect(application.teamSlotId).toBeNull();

    const accepted = await setApplicationStatus(application.id, poster.id, "ACCEPTED");
    expect(accepted.status).toBe("ACCEPTED");

    // A second application from the same user for the same (non-slotted) opportunity
    // is still rejected — the original uniqueness invariant must survive the migration
    // that introduced the nullable teamSlotId column.
    await expect(applyToOpportunity(opportunity.id, applicantA.id, {})).rejects.toThrow();
  });

  it("creates a MICROTASK opportunity with its structured fields", async () => {
    const opportunity = await createOpportunity(poster.id, {
      type: "TASK",
      kind: "MICROTASK",
      title: `Weekly gig ${RUN_ID}`,
      description: "Water the plants",
      locationType: "ONSITE",
      geoScope: "LOCAL",
      estimatedHours: 2,
      isRecurring: true,
      recurrenceNote: "weekly",
    });
    expect(opportunity.estimatedHours).toBe(2);
    expect(opportunity.isRecurring).toBe(true);
    expect(opportunity.recurrenceNote).toBe("weekly");
  });

  it("creates an APPRENTICESHIP opportunity with duration + focus fields", async () => {
    const opportunity = await createOpportunity(poster.id, {
      type: "CONTRACT",
      kind: "APPRENTICESHIP",
      title: `Apprentice woodworker ${RUN_ID}`,
      description: "Learn the trade",
      locationType: "ONSITE",
      geoScope: "REGION",
      durationWeeks: 12,
      mentorshipFocus: "Joinery basics",
    });
    expect(opportunity.durationWeeks).toBe(12);
    expect(opportunity.mentorshipFocus).toBe("Joinery basics");
  });

  it("rejects team slots on a non-TEAM_PROJECT opportunity", async () => {
    await expect(
      createOpportunity(poster.id, {
        type: "TASK",
        kind: "STANDARD",
        title: `Bad input ${RUN_ID}`,
        description: "Should fail",
        locationType: "REMOTE",
        geoScope: "LOCAL",
        teamSlots: [{ roleTitle: "Helper" }],
      }),
    ).rejects.toBeInstanceOf(OpportunityValidationError);
  });

  it("requires at least one team slot on a TEAM_PROJECT opportunity", async () => {
    await expect(
      createOpportunity(poster.id, {
        type: "CONTRACT",
        kind: "TEAM_PROJECT",
        title: `No slots ${RUN_ID}`,
        description: "Should fail",
        locationType: "REMOTE",
        geoScope: "LOCAL",
      }),
    ).rejects.toBeInstanceOf(OpportunityValidationError);
  });

  it("assembles a team: enforces per-slot headcount and lets distinct applicants fill distinct slots", async () => {
    const opportunity = await createOpportunity(poster.id, {
      type: "CONTRACT",
      kind: "TEAM_PROJECT",
      title: `Build a shed ${RUN_ID}`,
      description: "Need a small crew",
      locationType: "ONSITE",
      geoScope: "LOCAL",
      teamSlots: [
        { roleTitle: "Carpenter", skillId, headcountNeeded: 1 },
        { roleTitle: "Electrician", headcountNeeded: 1 },
      ],
    });
    const [carpenterSlot, electricianSlot] = opportunity.teamSlots;

    // Applying without a teamSlotId on a team project is rejected.
    await expect(applyToOpportunity(opportunity.id, applicantA.id, {})).rejects.toBeInstanceOf(
      OpportunityValidationError,
    );

    const appA = await applyToOpportunity(opportunity.id, applicantA.id, { teamSlotId: carpenterSlot.id });
    const appB = await applyToOpportunity(opportunity.id, applicantB.id, { teamSlotId: carpenterSlot.id });
    const appC = await applyToOpportunity(opportunity.id, applicantC.id, { teamSlotId: electricianSlot.id });

    // Accept the first carpenter applicant — fills that slot (headcountNeeded: 1).
    await setApplicationStatus(appA.id, poster.id, "ACCEPTED");

    // Accepting a second applicant for the now-full carpenter slot must be refused.
    await expect(setApplicationStatus(appB.id, poster.id, "ACCEPTED")).rejects.toBeInstanceOf(
      OpportunitySlotCapacityError,
    );

    // The electrician slot is unaffected — independent capacity per slot.
    const acceptedElectrician = await setApplicationStatus(appC.id, poster.id, "ACCEPTED");
    expect(acceptedElectrician.status).toBe("ACCEPTED");

    const full = await getOpportunity(opportunity.id);
    const carpenter = full!.teamSlots.find((s) => s.id === carpenterSlot.id)!;
    const electrician = full!.teamSlots.find((s) => s.id === electricianSlot.id)!;
    expect(carpenter.headcountFilled).toBe(1);
    expect(electrician.headcountFilled).toBe(1);
  });

  it("lets the same applicant apply to two different slots on the same team project", async () => {
    const opportunity = await createOpportunity(poster.id, {
      type: "CONTRACT",
      kind: "TEAM_PROJECT",
      title: `Multi-role project ${RUN_ID}`,
      description: "One person can cover two roles",
      locationType: "REMOTE",
      geoScope: "GLOBAL",
      teamSlots: [{ roleTitle: "Writer" }, { roleTitle: "Editor" }],
    });
    const [writerSlot, editorSlot] = opportunity.teamSlots;

    await expect(
      applyToOpportunity(opportunity.id, applicantA.id, { teamSlotId: writerSlot.id }),
    ).resolves.toBeDefined();
    await expect(
      applyToOpportunity(opportunity.id, applicantA.id, { teamSlotId: editorSlot.id }),
    ).resolves.toBeDefined();
  });
});
