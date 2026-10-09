import { getDashboardStats } from "@/lib/services/admin-dashboard-service";
import { getSafetyMetricsSummary } from "@/lib/services/safety-metrics-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function pct(n: number) {
  return `${n.toFixed(0)}%`;
}

export default async function AdminOverviewPage() {
  const stats = await getDashboardStats();
  const safety = await getSafetyMetricsSummary(30);

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

  const safetyTiles: { label: string; value: string }[] = [
    {
      label: "Complaint rate (30d, per 100 users)",
      value: safety.complaintRate.perHundredUsers === null ? "—" : safety.complaintRate.perHundredUsers.toFixed(2),
    },
    {
      label: "Dispute resolution time (avg, 30d)",
      value: safety.disputeResolutionTime.avgHours === null ? "No resolved disputes yet" : `${safety.disputeResolutionTime.avgHours.toFixed(1)}h`,
    },
    {
      label: "Verification review time (avg, 30d)",
      value:
        safety.verificationReviewTime.avgHours === null
          ? "No resolved claims yet"
          : `${safety.verificationReviewTime.avgHours.toFixed(1)}h`,
    },
    {
      label: "Abuse flags raised / confirmed (30d)",
      value: `${safety.abuseFlags.raised} / ${safety.abuseFlags.confirmed}`,
    },
    { label: "False verification rate", value: "Not yet measurable — see docs" },
    { label: "Privacy incidents (30d)", value: String(safety.privacyIncidents.count) },
  ];

  return (
    <div className="flex flex-col gap-8">
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

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">Trust &amp; safety metrics (30 days)</h2>
          <p className="text-xs text-ink-muted">
            False verification rate has no real signal source yet in this build — it needs
            Track 2&apos;s claim-appeal data. See docs/roadmap/09-trust-safety-and-moderation.md.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {safetyTiles.map((tile) => (
            <Card key={tile.label}>
              <CardHeader>
                <CardTitle className="text-base">{tile.value}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-ink-muted">{tile.label}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
