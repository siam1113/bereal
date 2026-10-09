import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { listReports, resolveReport } from "@/lib/services/admin-report-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

async function resolveAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const reportId = String(formData.get("reportId"));
  const resolution = String(formData.get("resolution")) as "ACTIONED" | "DISMISSED";
  await resolveReport(reportId, resolution, admin.id);
  revalidatePath("/admin/reports");
}

export default async function AdminReportsPage() {
  const openReports = await listReports(["OPEN", "UNDER_REVIEW"]);
  const resolvedReports = await listReports(["ACTIONED", "DISMISSED"]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-ink">Moderation queue</h1>
      <div className="flex flex-col gap-3">
        {openReports.length === 0 ? (
          <p className="text-sm text-ink-muted">No open reports.</p>
        ) : null}
        {openReports.map((report) => (
          <Card key={report.id}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">
                  {report.targetType} · {report.targetId}
                </p>
                <Badge variant="warning">{report.status}</Badge>
              </div>
              <p className="text-sm text-ink-muted">
                Reported by {report.reporter.name ?? report.reporter.email}: “{report.reason}”
                {report.details ? ` — ${report.details}` : ""}
              </p>
              <form action={resolveAction} className="flex gap-2">
                <input type="hidden" name="reportId" value={report.id} />
                <Button name="resolution" value="ACTIONED" type="submit" variant="danger">
                  Action taken
                </Button>
                <Button name="resolution" value="DISMISSED" type="submit" variant="secondary">
                  Dismiss
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">
          Resolved ({resolvedReports.length})
        </h2>
        <div className="flex flex-col gap-2">
          {resolvedReports.map((report) => (
            <Card key={report.id}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <p>
                  {report.targetType} · {report.reason}
                </p>
                <Badge variant={report.status === "ACTIONED" ? "danger" : "neutral"}>
                  {report.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
