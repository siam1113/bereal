import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth-helpers";
import type {
  ApplicationStatus,
  GeoScope,
  LocationType,
  OpportunityKind,
  OpportunityStatus,
  OpportunityType,
} from "@prisma/client";

/** Thrown when input shape doesn't match the opportunity's kind (e.g. team slots on a non-team-project). */
export class OpportunityValidationError extends Error {}
/** Thrown when accepting an application would push a team slot's accepted headcount past what's needed. */
export class OpportunitySlotCapacityError extends Error {}

export async function listOpportunities(filters: {
  skillId?: string;
  geoScope?: GeoScope;
  type?: OpportunityType;
  kind?: OpportunityKind;
  status?: OpportunityStatus;
}) {
  return prisma.opportunity.findMany({
    where: {
      ...(filters.skillId ? { skillId: filters.skillId } : {}),
      ...(filters.geoScope ? { geoScope: filters.geoScope } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      status: filters.status ?? "OPEN",
    },
    include: {
      postedBy: { select: { name: true, personProfile: { select: { slug: true } } } },
      business: { select: { name: true, slug: true } },
      skill: true,
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOpportunity(id: string) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      postedBy: { select: { id: true, name: true, personProfile: { select: { slug: true } } } },
      business: { select: { name: true, slug: true } },
      skill: true,
      teamSlots: {
        include: {
          skill: true,
          applications: {
            include: { applicant: { select: { id: true, name: true, personProfile: { select: { slug: true } } } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      applications: {
        // Only the single-hire / non-slotted applications — TEAM_PROJECT applications
        // are scoped to their slot and rendered via `teamSlots` above instead.
        where: { teamSlotId: null },
        include: { applicant: { select: { name: true, personProfile: { select: { slug: true } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!opportunity) return null;

  // Derived, not stored: filled headcount per slot is always a live count of ACCEPTED
  // applications, so it can never drift from the applications it's counting (see schema
  // comment on OpportunityTeamSlot).
  const teamSlots = opportunity.teamSlots.map((slot) => ({
    ...slot,
    headcountFilled: slot.applications.filter((a) => a.status === "ACCEPTED").length,
  }));

  return { ...opportunity, teamSlots };
}

export interface TeamSlotInput {
  roleTitle: string;
  skillId?: string;
  headcountNeeded?: number;
}

export async function createOpportunity(
  postedByUserId: string,
  input: {
    businessId?: string;
    type: OpportunityType;
    kind?: OpportunityKind;
    title: string;
    description: string;
    skillId?: string;
    locationType: LocationType;
    geoScope: GeoScope;
    // MICROTASK
    estimatedHours?: number;
    isRecurring?: boolean;
    recurrenceNote?: string;
    // APPRENTICESHIP — see schema.prisma comment on Opportunity.mentorshipFocus: this
    // is a plain free-text stand-in, not wired to Track 3/5's constructs.
    durationWeeks?: number;
    mentorshipFocus?: string;
    // TEAM_PROJECT
    teamSlots?: TeamSlotInput[];
  },
) {
  const kind = input.kind ?? "STANDARD";
  if (input.teamSlots && input.teamSlots.length > 0 && kind !== "TEAM_PROJECT") {
    throw new OpportunityValidationError("Team slots can only be set on a TEAM_PROJECT opportunity");
  }
  if (kind === "TEAM_PROJECT" && (!input.teamSlots || input.teamSlots.length === 0)) {
    throw new OpportunityValidationError("A team project needs at least one team slot");
  }

  return prisma.opportunity.create({
    data: {
      postedByUserId,
      businessId: input.businessId,
      type: input.type,
      kind,
      title: input.title,
      description: input.description,
      skillId: input.skillId,
      locationType: input.locationType,
      geoScope: input.geoScope,
      estimatedHours: input.estimatedHours,
      isRecurring: input.isRecurring ?? false,
      recurrenceNote: input.recurrenceNote,
      durationWeeks: input.durationWeeks,
      mentorshipFocus: input.mentorshipFocus,
      ...(input.teamSlots && input.teamSlots.length > 0
        ? {
            teamSlots: {
              create: input.teamSlots.map((slot) => ({
                roleTitle: slot.roleTitle,
                skillId: slot.skillId,
                headcountNeeded: slot.headcountNeeded ?? 1,
              })),
            },
          }
        : {}),
    },
    include: { teamSlots: true },
  });
}

/** Add another open role to an existing TEAM_PROJECT opportunity. Poster-only. */
export async function addTeamSlot(opportunityId: string, actingUserId: string, input: TeamSlotInput) {
  const opportunity = await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
  if (opportunity.postedByUserId !== actingUserId) {
    throw new ForbiddenError("Only the poster can add a team slot");
  }
  if (opportunity.kind !== "TEAM_PROJECT") {
    throw new OpportunityValidationError("Team slots can only be added to a TEAM_PROJECT opportunity");
  }
  return prisma.opportunityTeamSlot.create({
    data: {
      opportunityId,
      roleTitle: input.roleTitle,
      skillId: input.skillId,
      headcountNeeded: input.headcountNeeded ?? 1,
    },
  });
}

export async function applyToOpportunity(
  opportunityId: string,
  applicantUserId: string,
  options: { coverMessage?: string; teamSlotId?: string } = {},
) {
  const opportunity = await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });

  if (options.teamSlotId) {
    if (opportunity.kind !== "TEAM_PROJECT") {
      throw new OpportunityValidationError("This opportunity does not have team slots to apply to");
    }
    const slot = await prisma.opportunityTeamSlot.findUniqueOrThrow({ where: { id: options.teamSlotId } });
    if (slot.opportunityId !== opportunityId) {
      throw new OpportunityValidationError("That team slot does not belong to this opportunity");
    }
  } else if (opportunity.kind === "TEAM_PROJECT") {
    throw new OpportunityValidationError("Choose a team slot to apply to on a team project");
  }

  return prisma.application.create({
    data: {
      opportunityId,
      applicantUserId,
      teamSlotId: options.teamSlotId,
      coverMessage: options.coverMessage,
    },
  });
}

export async function setApplicationStatus(applicationId: string, actingUserId: string, status: ApplicationStatus) {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { opportunity: true, teamSlot: true },
  });
  if (application.opportunity.postedByUserId !== actingUserId) {
    throw new ForbiddenError("Only the opportunity poster can update application status");
  }

  if (status === "ACCEPTED" && application.teamSlotId) {
    const acceptedCount = await prisma.application.count({
      where: { teamSlotId: application.teamSlotId, status: "ACCEPTED" },
    });
    const slot = application.teamSlot!;
    if (acceptedCount >= slot.headcountNeeded) {
      throw new OpportunitySlotCapacityError(`The "${slot.roleTitle}" slot is already fully staffed`);
    }
  }

  return prisma.application.update({ where: { id: applicationId }, data: { status } });
}

export async function setOpportunityStatus(opportunityId: string, actingUserId: string, status: OpportunityStatus) {
  const opportunity = await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
  if (opportunity.postedByUserId !== actingUserId) {
    throw new ForbiddenError("Only the poster can update this opportunity's status");
  }
  return prisma.opportunity.update({ where: { id: opportunityId }, data: { status } });
}
