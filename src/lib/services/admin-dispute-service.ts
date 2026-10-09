import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { resolveReviewCaseFor } from "@/lib/services/review-case-service";
import type { DisputeStatus } from "@prisma/client";

export async function listDisputes(statusFilter?: DisputeStatus[]) {
  return prisma.relationshipDispute.findMany({
    where: statusFilter ? { status: { in: statusFilter } } : undefined,
    include: {
      raisedBy: { select: { id: true, name: true, email: true } },
      relationship: {
        include: {
          partyA: { select: { id: true, name: true, email: true } },
          partyB: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveDispute(
  disputeId: string,
  resolution: "RESOLVED_UPHELD" | "RESOLVED_REMOVED",
  notes: string,
  adminUserId: string,
) {
  const dispute = await prisma.relationshipDispute.update({
    where: { id: disputeId },
    data: { status: resolution, resolutionNotes: notes, resolvedAt: new Date() },
  });

  await logAudit({
    actorUserId: adminUserId,
    action: `DISPUTE_${resolution}`,
    targetType: "RelationshipDispute",
    targetId: disputeId,
    metadata: { relationshipId: dispute.relationshipId, notes },
  });

  // Track 9: close the generic workflow envelope and record the dispute-resolution-
  // time metric. No-op if this dispute predates the ReviewCase mechanism.
  await resolveReviewCaseFor({
    caseType: "DISPUTE",
    entityType: "RELATIONSHIP_DISPUTE",
    entityId: disputeId,
    outcome: resolution,
    actorUserId: adminUserId,
  });

  return dispute;
}
