import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { ReportStatus } from "@prisma/client";

export async function listReports(statusFilter?: ReportStatus[]) {
  return prisma.report.findMany({
    where: statusFilter ? { status: { in: statusFilter } } : undefined,
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      targetUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveReport(
  reportId: string,
  resolution: "ACTIONED" | "DISMISSED",
  adminUserId: string,
) {
  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status: resolution, resolvedAt: new Date(), resolvedByUserId: adminUserId },
  });

  await logAudit({
    actorUserId: adminUserId,
    action: `REPORT_${resolution}`,
    targetType: "Report",
    targetId: reportId,
    metadata: { reportTargetType: report.targetType, reportTargetId: report.targetId },
  });

  return report;
}
