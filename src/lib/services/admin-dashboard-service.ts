import { prisma } from "@/lib/prisma";

export interface DashboardStats {
  totalUsers: number;
  totalProfiles: number;
  pctWithPrimarySkill: number;
  pctWithPortfolio: number;
  openDisputes: number;
  openReports: number;
  pendingClaims: number;
  avgModerationTurnaroundHours: number | null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [totalUsers, totalProfiles, profilesWithPrimarySkill, profilesWithPortfolio, openDisputes, openReports, pendingClaims, resolvedReports] =
    await Promise.all([
      prisma.user.count({ where: { status: { not: "DELETED" } } }),
      prisma.personProfile.count(),
      prisma.personProfile.count({ where: { personSkills: { some: { isPrimary: true } } } }),
      prisma.personProfile.count({ where: { portfolioItems: { some: {} } } }),
      prisma.relationshipDispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      prisma.report.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      prisma.credentialClaim.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
      prisma.report.findMany({
        where: { status: { in: ["ACTIONED", "DISMISSED"] }, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

  const turnaroundHours = resolvedReports
    .map((r) => (r.resolvedAt ? (r.resolvedAt.getTime() - r.createdAt.getTime()) / 36e5 : null))
    .filter((h): h is number => h !== null);

  const avgModerationTurnaroundHours =
    turnaroundHours.length > 0
      ? turnaroundHours.reduce((a, b) => a + b, 0) / turnaroundHours.length
      : null;

  return {
    totalUsers,
    totalProfiles,
    pctWithPrimarySkill: totalProfiles > 0 ? (profilesWithPrimarySkill / totalProfiles) * 100 : 0,
    pctWithPortfolio: totalProfiles > 0 ? (profilesWithPortfolio / totalProfiles) * 100 : 0,
    openDisputes,
    openReports,
    pendingClaims,
    avgModerationTurnaroundHours,
  };
}
