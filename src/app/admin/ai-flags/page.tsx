import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { listAiFlags, resolveAiFlag, runFraudSignalScanAsAdmin } from "@/lib/services/admin-ai-flag-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

async function resolveAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const flagId = String(formData.get("flagId"));
  const resolution = String(formData.get("resolution")) as "REVIEWED_ACTIONED" | "REVIEWED_DISMISSED";
  const notes = String(formData.get("notes") ?? "");
  await resolveAiFlag(flagId, resolution, notes, admin.id);
  revalidatePath("/admin/ai-flags");
}

async function runScanAction() {
  "use server";
  const admin = await requireAdmin();
  await runFraudSignalScanAsAdmin(admin.id);
  revalidatePath("/admin/ai-flags");
}

export default async function AdminAiFlagsPage() {
  const pending = await listAiFlags(["PENDING"]);
  const resolved = await listAiFlags(["REVIEWED_ACTIONED", "REVIEWED_DISMISSED"]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">AI-flagged patterns</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Automated heuristics only — never an auto-reject or auto-confirm. Every flag
            below is AI-generated and cites the exact records it looked at; none of it
            is a verified fact until an admin reviews it here. Kept separate from the
            human-filed Reports and Disputes queues on purpose, so AI output is never
            mistaken for a user report.
          </p>
        </div>
        <form action={runScanAction}>
          <Button type="submit" variant="secondary">
            Run fraud-signal scan
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        {pending.length === 0 ? <p className="text-sm text-ink-muted">No pending AI flags.</p> : null}
        {pending.map((flag) => (
          <Card key={flag.id} className="border-dashed">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">
                  {flag.targetType} · {flag.targetId}
                </p>
                <div className="flex gap-2">
                  <Badge variant="outline">AI-generated</Badge>
                  <Badge variant="warning">{flag.reasonCode}</Badge>
                </div>
              </div>
              <p className="text-sm text-ink-muted">{flag.explanation}</p>
              <pre className="overflow-x-auto rounded-md bg-accent-soft p-3 text-xs text-ink-muted">
                {JSON.stringify(flag.evidenceRefs, null, 2)}
              </pre>
              <form action={resolveAction} className="flex flex-col gap-2">
                <input type="hidden" name="flagId" value={flag.id} />
                <Textarea name="notes" placeholder="Review notes" />
                <div className="flex gap-2">
                  <Button name="resolution" value="REVIEWED_ACTIONED" type="submit" variant="danger">
                    Action taken
                  </Button>
                  <Button name="resolution" value="REVIEWED_DISMISSED" type="submit" variant="secondary">
                    Dismiss
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Reviewed ({resolved.length})</h2>
        <div className="flex flex-col gap-2">
          {resolved.map((flag) => (
            <Card key={flag.id}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <p>
                  {flag.targetType} · {flag.reasonCode}
                  {flag.reviewedBy ? ` — reviewed by ${flag.reviewedBy.name ?? flag.reviewedBy.email}` : ""}
                </p>
                <Badge variant={flag.status === "REVIEWED_ACTIONED" ? "danger" : "neutral"}>
                  {flag.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
