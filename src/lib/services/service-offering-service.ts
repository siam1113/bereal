import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth-helpers";
import type { InquiryStatus } from "@prisma/client";

export async function listServiceOfferings(filters: { skillId?: string; query?: string }) {
  return prisma.serviceOffering.findMany({
    where: {
      isActive: true,
      ...(filters.skillId ? { skillId: filters.skillId } : {}),
      ...(filters.query
        ? {
            OR: [
              { title: { contains: filters.query, mode: "insensitive" } },
              { description: { contains: filters.query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      personProfile: { select: { slug: true, displayName: true } },
      business: { select: { slug: true, name: true } },
      skill: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getServiceOffering(id: string) {
  return prisma.serviceOffering.findUnique({
    where: { id },
    include: {
      personProfile: { select: { slug: true, displayName: true, userId: true } },
      business: { select: { slug: true, name: true, ownerUserId: true } },
      skill: true,
    },
  });
}

async function assertOwnsOffering(offeringId: string, userId: string) {
  const offering = await prisma.serviceOffering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { personProfile: true, business: true },
  });
  const owns =
    offering.personProfile?.userId === userId || offering.business?.ownerUserId === userId;
  if (!owns) throw new ForbiddenError("You don't own this service offering");
  return offering;
}

export async function listMyServiceOfferings(userId: string) {
  return prisma.serviceOffering.findMany({
    where: {
      OR: [{ personProfile: { userId } }, { business: { ownerUserId: userId } }],
    },
    include: { skill: true, business: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createServiceOffering(
  userId: string,
  input: {
    personProfileId?: string;
    businessId?: string;
    title: string;
    description: string;
    skillId?: string;
    priceNote?: string;
  },
) {
  if (input.businessId) {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: input.businessId } });
    if (business.ownerUserId !== userId) throw new ForbiddenError("You don't own this business");
  }
  return prisma.serviceOffering.create({
    data: {
      personProfileId: input.personProfileId,
      businessId: input.businessId,
      title: input.title,
      description: input.description,
      skillId: input.skillId,
      priceNote: input.priceNote,
    },
  });
}

export async function updateServiceOffering(
  offeringId: string,
  userId: string,
  input: Partial<{ title: string; description: string; skillId: string | null; priceNote: string | null; isActive: boolean }>,
) {
  await assertOwnsOffering(offeringId, userId);
  return prisma.serviceOffering.update({ where: { id: offeringId }, data: input });
}

export async function deleteServiceOffering(offeringId: string, userId: string) {
  await assertOwnsOffering(offeringId, userId);
  await prisma.serviceOffering.delete({ where: { id: offeringId } });
}

export async function createInquiry(serviceOfferingId: string, inquirerUserId: string, message: string) {
  return prisma.inquiry.create({ data: { serviceOfferingId, inquirerUserId, message } });
}

export async function listInquiriesForOffering(offeringId: string, userId: string) {
  await assertOwnsOffering(offeringId, userId);
  return prisma.inquiry.findMany({
    where: { serviceOfferingId: offeringId },
    include: { inquirer: { select: { name: true, personProfile: { select: { slug: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function setInquiryStatus(inquiryId: string, userId: string, status: InquiryStatus) {
  const inquiry = await prisma.inquiry.findUniqueOrThrow({
    where: { id: inquiryId },
    include: { serviceOffering: { include: { personProfile: true, business: true } } },
  });
  const owns =
    inquiry.serviceOffering.personProfile?.userId === userId ||
    inquiry.serviceOffering.business?.ownerUserId === userId;
  if (!owns) throw new ForbiddenError("You don't own this service offering");
  return prisma.inquiry.update({ where: { id: inquiryId }, data: { status } });
}
