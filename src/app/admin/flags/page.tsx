import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { listFlags, dismissFlag, escalateFlag } from "@/lib/services/moderation-flag-service";
import { runAbuseDetectionScan } from "@/lib/services/abuse-detection-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

async function scanAction() {
  "use server";
  await requireAdmin();
  await runAbuseDetectionScan();
  revalidatePath("/admin/flags");
}

async function triageAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const flagId = String(formData.get("flagId"));
  const action = String(formData.get("action")) as "ESCALATE" | "DISMISS";
  if (action === "ESCALATE") {
    await escalateFlag(flagId, admin.id);
  } else {
    await dismissFlag(flagId, admin.id);
  }
  revalidatePath("/admin/flags");
}

const severityVariant = { LOW: "neutral", MEDIUM: "warning", HIGH: "danger" } as const;

export default async function AdminFlagsPage() {
  const openFlags = await listFlags(["OPEN", "UNDER_REVIEW"]);
  const triagedFlags = await listFlags(["ESCALATED", "DISMISSED"]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-ink">Abuse-pattern flags</h1>
        <form action={scanAction}>
          <Button type="submit" variant="secondary">
            Run abuse-pattern scan
          </Button>
        </form>
      </div>
      <p className="text-sm text-ink-muted">
        System-detected signals, not human reports (see Reports for those). Nothing here
        auto-actions against a user — escalating opens a review case; dismissing clears it.
      </p>

      <div className="flex flex-col gap-3">
        {openFlags.length === 0 ? <p className="text-sm text-ink-muted">No open flags.</p> : null}
        {openFlags.map((flag) => (
          <Card key={flag.id}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">
                  {flag.patternType} · {flag.entityType}:{flag.entityId}
                </p>
                <Badge variant={severityVariant[flag.severity]}>{flag.severity}</Badge>
              </div>
              <p className="text-xs text-ink-muted">
                Detector: {flag.detectorId} · Raised {flag.createdAt.toLocaleString()}
              </p>
              <pre className="overflow-x-auto rounded-md bg-accent-soft p-2 text-xs text-ink-muted">
                {JSON.stringify(flag.evidence, null, 2)}
              </pre>
              <form action={triageAction} className="flex gap-2">
                <input type="hidden" name="flagId" value={flag.id} />
                <Button name="action" value="ESCALATE" type="submit" variant="danger">
                  Escalate to review case
                </Button>
                <Button name="action" value="DISMISS" type="submit" variant="secondary">
                  Dismiss
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Triaged ({triagedFlags.length})</h2>
        <div className="flex flex-col gap-2">
          {triagedFlags.map((flag) => (
            <Card key={flag.id}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <p>
                  {flag.patternType} · {flag.entityType}:{flag.entityId}
                </p>
                <Badge variant={flag.status === "ESCALATED" ? "danger" : "neutral"}>{flag.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
