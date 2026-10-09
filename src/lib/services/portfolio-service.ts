import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import type { Visibility } from "@prisma/client";

interface PortfolioItemInput {
  title: string;
  description?: string;
  images?: string[];
  tags?: string[];
  links?: { label: string; url: string }[];
  dateOccurred?: string | null;
  visibility?: Visibility;
  skillIds?: string[];
}

async function ownProfileId(userId: string) {
  const profile = await prisma.personProfile.findUniqueOrThrow({ where: { userId } });
  return profile.id;
}

export async function listOwnPortfolioItems() {
  const user = await requireUser();
  const profileId = await ownProfileId(user.id);
  return prisma.portfolioItem.findMany({
    where: { personProfileId: profileId },
    include: { skills: { include: { skill: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOwnPortfolioItem(id: string) {
  const user = await requireUser();
  const profileId = await ownProfileId(user.id);
  const item = await prisma.portfolioItem.findUnique({
    where: { id },
    include: { skills: true },
  });
  if (!item || item.personProfileId !== profileId) throw new Error("Not found");
  return item;
}

export async function createPortfolioItem(input: PortfolioItemInput) {
  const user = await requireUser();
  const profileId = await ownProfileId(user.id);

  return prisma.portfolioItem.create({
    data: {
      personProfileId: profileId,
      title: input.title,
      description: input.description,
      images: input.images ?? [],
      tags: input.tags ?? [],
      links: input.links ?? undefined,
      dateOccurred: input.dateOccurred ? new Date(input.dateOccurred) : undefined,
      visibility: input.visibility ?? "PUBLIC",
      skills: input.skillIds?.length
        ? { create: input.skillIds.map((skillId) => ({ skillId })) }
        : undefined,
    },
  });
}

export async function updatePortfolioItem(id: string, input: PortfolioItemInput) {
  const user = await requireUser();
  const profileId = await ownProfileId(user.id);
  const existing = await prisma.portfolioItem.findUnique({ where: { id } });
  if (!existing || existing.personProfileId !== profileId) throw new Error("Not found");

  return prisma.portfolioItem.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      images: input.images,
      tags: input.tags,
      links: input.links ?? undefined,
      dateOccurred: input.dateOccurred ? new Date(input.dateOccurred) : undefined,
      visibility: input.visibility,
      skills: input.skillIds
        ? {
            deleteMany: {},
            create: input.skillIds.map((skillId) => ({ skillId })),
          }
        : undefined,
    },
  });
}

export async function deletePortfolioItem(id: string) {
  const user = await requireUser();
  const profileId = await ownProfileId(user.id);
  const existing = await prisma.portfolioItem.findUnique({ where: { id } });
  if (!existing || existing.personProfileId !== profileId) throw new Error("Not found");

  await prisma.portfolioItem.delete({ where: { id } });
}
