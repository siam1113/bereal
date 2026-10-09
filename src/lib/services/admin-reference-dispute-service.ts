import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { DisputeStatus } from "@prisma/client";

/**
 * Admin review queue for Reference disputes — mirrors admin-dispute-service.ts
 * (relationship disputes) exactly. Resolving a dispute here only records the
 * resolution; it does not itself revoke the Reference (see revokeReference() in
 * reference-service.ts for the explicit, separate action an admin takes if a dispute
 * is upheld).
 */
export async function listReferenceDisputes(statusFilter?: DisputeStatus[]) {
  return prisma.referenceDispute.findMany({
    where: statusFilter ? { status: { in: statusFilter } } : undefined,
    include: {
      raisedBy: { select: { id: true, name: true, email: true } },
      reference: {
        include: {
          author: { select: { id: true, name: true, email: true } },
          subject: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveReferenceDispute(
  disputeId: string,
  resolution: "RESOLVED_UPHELD" | "RESOLVED_REMOVED",
  notes: string,
  adminUserId: string,
) {
  const dispute = await prisma.referenceDispute.update({
    where: { id: disputeId },
    data: { status: resolution, resolutionNotes: notes, resolvedAt: new Date() },
  });

  await logAudit({
    actorUserId: adminUserId,
    action: `REFERENCE_DISPUTE_${resolution}`,
    targetType: "ReferenceDispute",
    targetId: disputeId,
    metadata: { referenceId: dispute.referenceId, notes },
  });

  return dispute;
}
