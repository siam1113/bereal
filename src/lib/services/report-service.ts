import { prisma } from "@/lib/prisma";
import type { ReportStatus, ReportTargetType } from "@prisma/client";

export async function createReport(input: {
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
  reason: string;
  details?: string;
}) {
  return prisma.report.create({
    data: {
      reporterUserId: input.reporterUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetUserId: input.targetUserId,
      reason: input.reason,
      details: input.details,
      status: "OPEN" satisfies ReportStatus,
    },
  });
}
