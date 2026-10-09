import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function awardBadge(input: {
  badgeDefinitionId: string;
  recipientUserId: string;
  issuerUserId?: string | null;
  basis?: Prisma.InputJsonValue;
  basisClaimId?: string;
  // Track 2 (identity & evidence): optional expiry — e.g. a feedback-derived
  // attribute badge that should lapse without fresh evidence. Most badges (and all
  // seed examples today) don't set this.
  expiresAt?: Date;
}) {
  const award = await prisma.badgeAward.create({
    data: {
      badgeDefinitionId: input.badgeDefinitionId,
      recipientUserId: input.recipientUserId,
      issuerUserId: input.issuerUserId ?? null,
      basis: input.basis,
      basisClaimId: input.basisClaimId,
      expiresAt: input.expiresAt,
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

/**
 * Only ACTIVE, not-yet-expired awards — lazy expiry check (no scheduler/cron exists
 * in this app), same "evaluate on read" approach as reference-service's
 * isReferenceExpired. An expired-but-not-yet-revoked award simply stops rendering
 * here; see expireOverdueBadgeAwards() for the explicit action that also flips status.
 */
export async function listBadgesForUser(recipientUserId: string) {
  const awards = await prisma.badgeAward.findMany({
    where: { recipientUserId, status: "ACTIVE" },
    include: { badgeDefinition: true },
    orderBy: { issuedAt: "desc" },
  });
  return awards.filter((award) => !isBadgeAwardExpired(award));
}

export function isBadgeAwardExpired(award: { expiresAt: Date | null }): boolean {
  return Boolean(award.expiresAt && award.expiresAt.getTime() < Date.now());
}

/**
 * Explicit, admin-invoked sweep that formally revokes ACTIVE awards past their
 * expiry — not a cron job (none exists), just a function an admin action or a future
 * scheduled task can call. Each revocation gets its own audit event via revokeBadge(),
 * same as a manual revoke.
 */
export async function expireOverdueBadgeAwards(adminUserId: string) {
  const overdue = await prisma.badgeAward.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
  });
  const revoked = [];
  for (const award of overdue) {
    revoked.push(await revokeBadge(award.id, adminUserId, "Expired"));
  }
  return revoked;
}
