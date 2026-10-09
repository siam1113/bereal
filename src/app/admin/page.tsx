import { getDashboardStats } from "@/lib/services/admin-dashboard-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function pct(n: number) {
  return `${n.toFixed(0)}%`;
}

export default async function AdminOverviewPage() {
  const stats = await getDashboardStats();

  const tiles: { label: string; value: string }[] = [
    { label: "Total users", value: String(stats.totalUsers) },
    { label: "Profiles with primary skill", value: pct(stats.pctWithPrimarySkill) },
    { label: "Profiles with portfolio", value: pct(stats.pctWithPortfolio) },
    { label: "Open disputes", value: String(stats.openDisputes) },
    { label: "Open reports", value: String(stats.openReports) },
    { label: "Pending claims", value: String(stats.pendingClaims) },
    {
      label: "Avg. moderation turnaround",
      value:
        stats.avgModerationTurnaroundHours === null
          ? "No resolved reports yet"
          : `${stats.avgModerationTurnaroundHours.toFixed(1)}h`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-ink">Admin overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardTitle className="text-base">{tile.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-ink-muted">{tile.label}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
