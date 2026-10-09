import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth-helpers";
import type {
  ApplicationStatus,
  GeoScope,
  LocationType,
  OpportunityStatus,
  OpportunityType,
} from "@prisma/client";

export async function listOpportunities(filters: {
  skillId?: string;
  geoScope?: GeoScope;
  type?: OpportunityType;
  status?: OpportunityStatus;
}) {
  return prisma.opportunity.findMany({
    where: {
      ...(filters.skillId ? { skillId: filters.skillId } : {}),
      ...(filters.geoScope ? { geoScope: filters.geoScope } : {}),
      ...(filters.type ? { type: filters.type } : {}),
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
  return prisma.opportunity.findUnique({
    where: { id },
    include: {
      postedBy: { select: { id: true, name: true, personProfile: { select: { slug: true } } } },
      business: { select: { name: true, slug: true } },
      skill: true,
      applications: {
        include: { applicant: { select: { name: true, personProfile: { select: { slug: true } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function createOpportunity(
  postedByUserId: string,
  input: {
    businessId?: string;
    type: OpportunityType;
    title: string;
    description: string;
    skillId?: string;
    locationType: LocationType;
    geoScope: GeoScope;
  },
) {
  return prisma.opportunity.create({
    data: {
      postedByUserId,
      businessId: input.businessId,
      type: input.type,
      title: input.title,
      description: input.description,
      skillId: input.skillId,
      locationType: input.locationType,
      geoScope: input.geoScope,
    },
  });
}

export async function applyToOpportunity(opportunityId: string, applicantUserId: string, coverMessage?: string) {
  return prisma.application.create({
    data: { opportunityId, applicantUserId, coverMessage },
  });
}

export async function setApplicationStatus(applicationId: string, actingUserId: string, status: ApplicationStatus) {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { opportunity: true },
  });
  if (application.opportunity.postedByUserId !== actingUserId) {
    throw new ForbiddenError("Only the opportunity poster can update application status");
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
