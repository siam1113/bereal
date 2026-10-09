import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { BadgeKind, Prisma } from "@prisma/client";

/**
 * Deliberately NOT named `badge-service.ts` — Vertical B may own that path with an
 * equivalent award/revoke pair. This lets the admin badges UI work standalone; prefer
 * Vertical B's service during integration if both exist.
 */
export async function listBadgeDefinitions() {
  return prisma.badgeDefinition.findMany({ orderBy: { name: "asc" } });
}

export async function createBadgeDefinition(input: {
  slug: string;
  name: string;
  description: string;
  kind: BadgeKind;
  criteria: Record<string, unknown>;
}) {
  return prisma.badgeDefinition.create({
    data: { ...input, criteria: input.criteria as Prisma.InputJsonValue },
  });
}

export async function setBadgeDefinitionActive(id: string, isActive: boolean) {
  return prisma.badgeDefinition.update({ where: { id }, data: { isActive } });
}

export async function awardBadge(
  badgeDefinitionId: string,
  recipientUserId: string,
  issuerUserId: string,
  basis?: Record<string, unknown>,
) {
  const award = await prisma.badgeAward.create({
    data: {
      badgeDefinitionId,
      recipientUserId,
      issuerUserId,
      basis: basis as Prisma.InputJsonValue | undefined,
    },
  });
  await logAudit({
    actorUserId: issuerUserId,
    action: "BADGE_AWARDED",
    targetType: "BadgeAward",
    targetId: award.id,
    metadata: { badgeDefinitionId, recipientUserId },
  });
  return award;
}

export async function revokeBadge(badgeAwardId: string, reason: string, adminUserId: string) {
  const award = await prisma.badgeAward.update({
    where: { id: badgeAwardId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason },
  });
  await logAudit({
    actorUserId: adminUserId,
    action: "BADGE_REVOKED",
    targetType: "BadgeAward",
    targetId: badgeAwardId,
    metadata: { reason },
  });
  return award;
}

export async function listAwardsForDefinition(badgeDefinitionId: string) {
  return prisma.badgeAward.findMany({
    where: { badgeDefinitionId },
    include: { recipient: { select: { id: true, name: true, email: true } } },
    orderBy: { issuedAt: "desc" },
  });
}

export async function searchUsersByEmail(query: string) {
  if (query.length < 2) return [];
  return prisma.user.findMany({
    where: { email: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
    take: 10,
  });
}
