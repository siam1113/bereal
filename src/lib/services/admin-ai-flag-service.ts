import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { runFraudSignalScan } from "@/lib/services/ai-fraud-signal-service";
import type { AiFlagStatus } from "@prisma/client";

/**
 * Admin-side review workflow for AiModerationFlag — deliberately a separate file from
 * ai-fraud-signal-service.ts (which only detects and creates PENDING flags), mirroring
 * this repo's existing split between claim-service.ts (subject-side) and
 * admin-claim-review-service.ts (admin decision workflow): detection and human review
 * never need to share state beyond the AiModerationFlag rows themselves.
 */

export async function listAiFlags(statusFilter?: AiFlagStatus[]) {
  return prisma.aiModerationFlag.findMany({
    where: statusFilter ? { status: { in: statusFilter } } : undefined,
    include: {
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveAiFlag(
  flagId: string,
  resolution: "REVIEWED_ACTIONED" | "REVIEWED_DISMISSED",
  notes: string,
  adminUserId: string,
) {
  const flag = await prisma.aiModerationFlag.update({
    where: { id: flagId },
    data: {
      status: resolution,
      reviewNotes: notes,
      reviewedAt: new Date(),
      reviewedByUserId: adminUserId,
    },
  });

  await logAudit({
    actorUserId: adminUserId,
    action: `AI_FLAG_${resolution}`,
    targetType: "AiModerationFlag",
    targetId: flagId,
    metadata: { flagTargetType: flag.targetType, flagTargetId: flag.targetId, reasonCode: flag.reasonCode },
  });

  return flag;
}

/**
 * Manually triggered by an admin from /admin/ai-flags — there is no background job
 * runner in this repo (see docs/architecture.md), so this is a deliberate "run now"
 * action rather than a cron job, same spirit as every other admin-triggered workflow
 * here. It only ever creates PENDING flags; it never acts on anything by itself.
 */
export async function runFraudSignalScanAsAdmin(adminUserId: string) {
  const result = await runFraudSignalScan();

  await logAudit({
    actorUserId: adminUserId,
    action: "AI_FRAUD_SIGNAL_SCAN_RUN",
    targetType: "AiModerationFlag",
    targetId: "scan",
    metadata: { ...result },
  });

  return result;
}
