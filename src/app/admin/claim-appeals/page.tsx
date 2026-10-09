import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { listClaimAppeals, resolveClaimAppeal } from "@/lib/services/claim-appeal-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

async function resolveAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const appealId = String(formData.get("appealId"));
  const resolution = String(formData.get("resolution")) as "RESOLVED_UPHELD" | "RESOLVED_REMOVED";
  const notes = String(formData.get("notes") ?? "");
  await resolveClaimAppeal(appealId, resolution, notes, admin.id);
  revalidatePath("/admin/claim-appeals");
}

export default async function AdminClaimAppealsPage() {
  const appeals = await listClaimAppeals(["OPEN", "UNDER_REVIEW"]);
  const resolved = await listClaimAppeals(["RESOLVED_UPHELD", "RESOLVED_REMOVED"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Claim appeals</h1>
        <p className="mt-1 text-sm text-ink-muted">
          A subject contesting a REJECTED or REVOKED claim decision. Resolving an appeal only
          records the outcome — reversing the original decision still requires an explicit
          re-review on the claim&apos;s own page, so every status change always has its own
          VerificationReview row.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {appeals.length === 0 ? <p className="text-sm text-ink-muted">No open appeals.</p> : null}
        {appeals.map((appeal) => (
          <Card key={appeal.id}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <Link href={`/admin/claims/${appeal.claim.id}`} className="font-medium text-ink underline">
                  {appeal.claim.title} ({appeal.claim.claimType})
                </Link>
                <Badge variant="warning">{appeal.status}</Badge>
              </div>
              <p className="text-sm text-ink-muted">
                Claim is {appeal.claim.status}. Appealed by{" "}
                {appeal.raisedBy.name ?? appeal.raisedBy.email}: “{appeal.reason}”
              </p>
              <form action={resolveAction} className="flex flex-col gap-2">
                <input type="hidden" name="appealId" value={appeal.id} />
                <Textarea name="notes" placeholder="Resolution notes" />
                <div className="flex gap-2">
                  <Button name="resolution" value="RESOLVED_UPHELD" type="submit" variant="secondary">
                    Uphold original decision
                  </Button>
                  <Button name="resolution" value="RESOLVED_REMOVED" type="submit">
                    Dismiss appeal
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
          {resolved.map((appeal) => (
            <Card key={appeal.id}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <Link href={`/admin/claims/${appeal.claim.id}`} className="underline">
                  {appeal.claim.title}
                </Link>
                <Badge variant={appeal.status === "RESOLVED_UPHELD" ? "neutral" : "success"}>
                  {appeal.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
