import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { uniqueSlug } from "@/lib/slug";

interface BusinessInput {
  name: string;
  description?: string;
  city?: string;
  region?: string;
  country?: string;
}

export async function getBusinessBySlug(slug: string) {
  return prisma.business.findUnique({
    where: { slug },
    include: {
      memberships: {
        where: { status: "CONFIRMED" },
        include: { user: { include: { personProfile: true } } },
      },
      portfolioItems: { where: { visibility: "PUBLIC" }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getOwnBusinessById(id: string) {
  const user = await requireUser();
  const business = await prisma.business.findUniqueOrThrow({ where: { id } });
  if (business.ownerUserId !== user.id) throw new Error("Only the owner can manage this business");
  return business;
}

export async function listOwnBusinesses() {
  const user = await requireUser();
  return prisma.business.findMany({
    where: {
      OR: [{ ownerUserId: user.id }, { memberships: { some: { userId: user.id, status: "CONFIRMED" } } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createBusiness(input: BusinessInput) {
  const user = await requireUser();
  const slug = await uniqueSlug(input.name, async (candidate) => {
    const found = await prisma.business.findUnique({ where: { slug: candidate } });
    return !!found;
  });

  const business = await prisma.business.create({
    data: {
      slug,
      name: input.name,
      description: input.description,
      city: input.city,
      region: input.region,
      country: input.country,
      ownerUserId: user.id,
    },
  });

  await prisma.businessMembership.create({
    data: { businessId: business.id, userId: user.id, role: "OWNER", status: "CONFIRMED", confirmedAt: new Date() },
  });

  return business;
}

export async function updateBusiness(id: string, input: BusinessInput) {
  const user = await requireUser();
  const business = await prisma.business.findUniqueOrThrow({ where: { id } });
  if (business.ownerUserId !== user.id) throw new Error("Only the owner can edit this business");

  return prisma.business.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      city: input.city,
      region: input.region,
      country: input.country,
    },
  });
}

/**
 * Anyone can claim membership in a business; it starts PENDING and is never
 * auto-confirmed — only the owner (or an admin) confirming it moves it to CONFIRMED.
 */
export async function claimBusinessMembership(businessId: string) {
  const user = await requireUser();
  return prisma.businessMembership.upsert({
    where: { businessId_userId: { businessId, userId: user.id } },
    update: {},
    create: { businessId, userId: user.id, role: "MEMBER", status: "PENDING" },
  });
}

export async function confirmBusinessMembership(businessId: string, memberUserId: string) {
  const user = await requireUser();
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (business.ownerUserId !== user.id) throw new Error("Only the owner can confirm memberships");

  return prisma.businessMembership.update({
    where: { businessId_userId: { businessId, userId: memberUserId } },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
}

export async function listMembershipsForOwner(businessId: string) {
  const user = await requireUser();
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (business.ownerUserId !== user.id) throw new Error("Only the owner can view pending membership claims");

  return prisma.businessMembership.findMany({
    where: { businessId },
    include: { user: { include: { personProfile: true } } },
    orderBy: { claimedAt: "desc" },
  });
}
