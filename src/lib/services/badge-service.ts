import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function awardBadge(input: {
  badgeDefinitionId: string;
  recipientUserId: string;
  issuerUserId?: string | null;
  basis?: Prisma.InputJsonValue;
  basisClaimId?: string;
}) {
  const award = await prisma.badgeAward.create({
    data: {
      badgeDefinitionId: input.badgeDefinitionId,
      recipientUserId: input.recipientUserId,
      issuerUserId: input.issuerUserId ?? null,
      basis: input.basis,
      basisClaimId: input.basisClaimId,
    },
  });
  await logAudit({
    actorUserId: input.issuerUserId ?? null,
    action: "badge.award",
    targetType: "BadgeAward",
    targetId: award.id,
    metadata: { badgeDefinitionId: input.badgeDefinitionId, recipientUserId: input.recipientUserId },
  });
  return award;
}

export async function revokeBadge(badgeAwardId: string, revokedByUserId: string, reason: string) {
  const award = await prisma.badgeAward.update({
    where: { id: badgeAwardId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason },
  });
  await logAudit({
    actorUserId: revokedByUserId,
    action: "badge.revoke",
    targetType: "BadgeAward",
    targetId: badgeAwardId,
    metadata: { reason },
  });
  return award;
}

export async function getBadgeAwardDetail(badgeAwardId: string) {
  return prisma.badgeAward.findUnique({
    where: { id: badgeAwardId },
    include: {
      badgeDefinition: true,
      recipient: { select: { id: true, name: true } },
      issuer: { select: { id: true, name: true } },
    },
  });
}

export async function listBadgesForUser(recipientUserId: string) {
  return prisma.badgeAward.findMany({
    where: { recipientUserId, status: "ACTIVE" },
    include: { badgeDefinition: true },
    orderBy: { issuedAt: "desc" },
  });
}
