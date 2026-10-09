import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth-helpers";
import type { GeoScope, HelpRequestStatus, HelpResponseStatus } from "@prisma/client";

export async function listHelpRequests(filters: { skillId?: string; geoScope?: GeoScope; status?: HelpRequestStatus }) {
  return prisma.helpRequest.findMany({
    where: {
      ...(filters.skillId ? { skillId: filters.skillId } : {}),
      ...(filters.geoScope ? { geoScope: filters.geoScope } : {}),
      status: filters.status ?? "OPEN",
    },
    include: { author: { select: { name: true, personProfile: { select: { slug: true } } } }, skill: true, _count: { select: { responses: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getHelpRequest(id: string) {
  return prisma.helpRequest.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, personProfile: { select: { slug: true } } } },
      skill: true,
      responses: {
        include: { responder: { select: { name: true, personProfile: { select: { slug: true } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function createHelpRequest(
  authorUserId: string,
  input: { title: string; description: string; skillId?: string; geoScope: GeoScope },
) {
  return prisma.helpRequest.create({
    data: {
      authorUserId,
      title: input.title,
      description: input.description,
      skillId: input.skillId,
      geoScope: input.geoScope,
    },
  });
}

export async function respondToHelpRequest(helpRequestId: string, responderUserId: string, message: string) {
  return prisma.helpResponse.create({
    data: { helpRequestId, responderUserId, message },
  });
}

export async function setHelpResponseStatus(
  responseId: string,
  actingUserId: string,
  status: HelpResponseStatus,
) {
  const response = await prisma.helpResponse.findUniqueOrThrow({
    where: { id: responseId },
    include: { helpRequest: true },
  });
  if (response.helpRequest.authorUserId !== actingUserId) {
    throw new ForbiddenError("Only the request author can update response status");
  }
  return prisma.helpResponse.update({ where: { id: responseId }, data: { status } });
}

export async function setHelpRequestStatus(
  helpRequestId: string,
  actingUserId: string,
  status: HelpRequestStatus,
) {
  const req = await prisma.helpRequest.findUniqueOrThrow({ where: { id: helpRequestId } });
  if (req.authorUserId !== actingUserId) {
    throw new ForbiddenError("Only the author can update this request's status");
  }
  return prisma.helpRequest.update({ where: { id: helpRequestId }, data: { status } });
}
