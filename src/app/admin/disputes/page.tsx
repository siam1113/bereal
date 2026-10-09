import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { listDisputes, resolveDispute } from "@/lib/services/admin-dispute-service";
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
  await resolveDispute(disputeId, resolution, notes, admin.id);
  revalidatePath("/admin/disputes");
}

export default async function AdminDisputesPage() {
  const disputes = await listDisputes(["OPEN", "UNDER_REVIEW"]);
  const resolved = await listDisputes(["RESOLVED_UPHELD", "RESOLVED_REMOVED"]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-ink">Relationship disputes</h1>
      <div className="flex flex-col gap-3">
        {disputes.length === 0 ? <p className="text-sm text-ink-muted">No open disputes.</p> : null}
        {disputes.map((dispute) => (
          <Card key={dispute.id}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">
                  {dispute.relationship.partyA.name ?? dispute.relationship.partyA.email} ↔{" "}
                  {dispute.relationship.partyB.name ?? dispute.relationship.partyB.email} ·{" "}
                  {dispute.relationship.type}
                </p>
                <Badge variant="warning">{dispute.status}</Badge>
              </div>
              <p className="text-sm text-ink-muted">
                Raised by {dispute.raisedBy.name ?? dispute.raisedBy.email}: “{dispute.reason}”
              </p>
              <form action={resolveAction} className="flex flex-col gap-2">
                <input type="hidden" name="disputeId" value={dispute.id} />
                <Textarea name="notes" placeholder="Resolution notes" />
                <div className="flex gap-2">
                  <Button name="resolution" value="RESOLVED_UPHELD" type="submit" variant="secondary">
                    Uphold (dispute valid, flag relationship)
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
                  {dispute.relationship.partyA.name ?? dispute.relationship.partyA.email} ↔{" "}
                  {dispute.relationship.partyB.name ?? dispute.relationship.partyB.email}
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
