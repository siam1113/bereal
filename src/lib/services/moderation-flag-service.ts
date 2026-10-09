import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { openReviewCase } from "@/lib/services/review-case-service";
import { recordSafetyMetricEvent } from "@/lib/services/safety-metrics-service";
import type { FlagSeverity, ModerationFlagStatus, Prisma } from "@prisma/client";

/**
 * Queue management for system/detector-raised `ModerationFlag`s — see the block
 * comment above `ModerationFlag` in prisma/schema.prisma. A flag never auto-actions
 * against a user; a human must triage it (escalate into a formal `ReviewCase`, or
 * dismiss it) via this file. Detectors (e.g. `abuse-detection-service.ts`) only
 * ever call `createFlag` — they don't touch `ReviewCase` directly.
 */

export async function createFlag(input: {
  entityType: string;
  entityId: string;
  subjectUserId?: string;
  patternType: string;
  severity?: FlagSeverity;
  detectorId: string;
  evidence: Record<string, unknown>;
}) {
  // Don't re-flag something already sitting open/under-review for the same pattern
  // — a detector re-run shouldn't fork the queue into duplicates.
  const existing = await prisma.moderationFlag.findFirst({
    where: {
      entityType: input.entityType,
      entityId: input.entityId,
      patternType: input.patternType,
      status: { in: ["OPEN", "UNDER_REVIEW"] },
    },
  });
  if (existing) return existing;

  const flag = await prisma.moderationFlag.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      subjectUserId: input.subjectUserId,
      patternType: input.patternType,
      severity: input.severity ?? "MEDIUM",
      detectorId: input.detectorId,
      evidence: input.evidence as Prisma.InputJsonValue,
    },
  });

  await recordSafetyMetricEvent({
    metricType: "ABUSE_FLAG_RAISED",
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: { patternType: input.patternType, detectorId: input.detectorId },
  });

  await logAudit({
    actorUserId: null,
    action: "moderation_flag.raise",
    targetType: "ModerationFlag",
    targetId: flag.id,
    metadata: { entityType: input.entityType, entityId: input.entityId, patternType: input.patternType, detectorId: input.detectorId },
  });

  return flag;
}

export async function listFlags(statusFilter?: ModerationFlagStatus[]) {
  return prisma.moderationFlag.findMany({
    where: { status: statusFilter ? { in: statusFilter } : undefined },
    include: {
      subject: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
  });
}

/**
 * Dismiss a flag as not actionable (false positive, insufficient signal). Does not
 * open a ReviewCase.
 */
export async function dismissFlag(flagId: string, adminUserId: string, notes?: string) {
  const flag = await prisma.moderationFlag.update({
    where: { id: flagId },
    data: { status: "DISMISSED", reviewedAt: new Date(), reviewedByUserId: adminUserId },
  });

  await logAudit({
    actorUserId: adminUserId,
    action: "moderation_flag.dismiss",
    targetType: "ModerationFlag",
    targetId: flagId,
    metadata: { notes },
  });

  return flag;
}

/**
 * Escalate a flag into a formal `ReviewCase` (caseType ABUSE_FLAG) for a human to
 * work through the same SLA/assignment machinery as disputes and verification
 * claims use.
 */
export async function escalateFlag(flagId: string, adminUserId: string) {
  const flag = await prisma.moderationFlag.update({
    where: { id: flagId },
    data: { status: "ESCALATED", reviewedAt: new Date(), reviewedByUserId: adminUserId },
  });

  const reviewCase = await openReviewCase({
    caseType: "ABUSE_FLAG",
    entityType: "MODERATION_FLAG",
    entityId: flag.id,
    subjectUserId: flag.subjectUserId ?? undefined,
    priority: flag.severity === "HIGH" ? "HIGH" : "NORMAL",
    actorUserId: adminUserId,
  });

  await recordSafetyMetricEvent({
    metricType: "ABUSE_FLAG_CONFIRMED",
    entityType: flag.entityType,
    entityId: flag.entityId,
    actorUserId: adminUserId,
    metadata: { flagId: flag.id, patternType: flag.patternType },
  });

  await logAudit({
    actorUserId: adminUserId,
    action: "moderation_flag.escalate",
    targetType: "ModerationFlag",
    targetId: flagId,
    metadata: { reviewCaseId: reviewCase.id },
  });

  return { flag, reviewCase };
}
