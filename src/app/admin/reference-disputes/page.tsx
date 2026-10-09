import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { listReferenceDisputes, resolveReferenceDispute } from "@/lib/services/admin-reference-dispute-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

async function resolveAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const disputeId = String(formData.get("disputeId"));
  const resolution = String(formData.get("resolution")) as "RESOLVED_UPHELD" | "RESOLVED_REMOVED";
  const notes = String(formData.get("notes") ?? "");
  await resolveReferenceDispute(disputeId, resolution, notes, admin.id);
  revalidatePath("/admin/reference-disputes");
}

export default async function AdminReferenceDisputesPage() {
  const disputes = await listReferenceDisputes(["OPEN", "UNDER_REVIEW"]);
  const resolved = await listReferenceDisputes(["RESOLVED_UPHELD", "RESOLVED_REMOVED"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Reference disputes</h1>
        <p className="mt-1 text-sm text-ink-muted">
          A subject disputing a reference someone wrote about them. Resolving here records the
          outcome only — to actually revoke a reference, use the explicit revoke action from the
          reference detail (never an implicit side effect of resolving a dispute).
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {disputes.length === 0 ? <p className="text-sm text-ink-muted">No open disputes.</p> : null}
        {disputes.map((dispute) => (
          <Card key={dispute.id}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">
                  {dispute.reference.author.name ?? dispute.reference.author.email} wrote about{" "}
                  {dispute.reference.subject.name ?? dispute.reference.subject.email}
                </p>
                <Badge variant="warning">{dispute.status}</Badge>
              </div>
              <p className="text-sm text-ink-muted">
                Disputed by {dispute.raisedBy.name ?? dispute.raisedBy.email}: “{dispute.reason}”
              </p>
              <form action={resolveAction} className="flex flex-col gap-2">
                <input type="hidden" name="disputeId" value={dispute.id} />
                <Textarea name="notes" placeholder="Resolution notes" />
                <div className="flex gap-2">
                  <Button name="resolution" value="RESOLVED_UPHELD" type="submit" variant="secondary">
                    Uphold (dispute valid)
                  </Button>
                  <Button name="resolution" value="RESOLVED_REMOVED" type="submit">
                    Dismiss dispute
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Resolved ({resolved.length})</h2>
        <div className="flex flex-col gap-2">
          {resolved.map((dispute) => (
            <Card key={dispute.id}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <p>
                  {dispute.reference.author.name ?? dispute.reference.author.email} ↔{" "}
                  {dispute.reference.subject.name ?? dispute.reference.subject.email}
                </p>
                <Badge variant={dispute.status === "RESOLVED_UPHELD" ? "danger" : "success"}>
                  {dispute.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
