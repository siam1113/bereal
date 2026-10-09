import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { decideClaim, getClaim } from "@/lib/services/admin-claim-review-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

async function decideAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const claimId = String(formData.get("claimId"));
  const decision = String(formData.get("decision")) as
    | "APPROVED"
    | "REJECTED"
    | "REQUEST_MORE_INFO"
    | "REVOKED";
  const notes = String(formData.get("notes") ?? "");
  const expiresAtRaw = String(formData.get("expiresAt") ?? "");
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : undefined;
  await decideClaim(claimId, admin.id, decision, notes || undefined, expiresAt);
  revalidatePath(`/admin/claims/${claimId}`);
  revalidatePath("/admin/claims");
}

export default async function AdminClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const claim = await getClaim(id);
  if (!claim) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-ink">{claim.title}</h1>
        <Badge variant={claim.status === "APPROVED" ? "success" : claim.status === "REJECTED" ? "danger" : "neutral"}>
          {claim.status}
        </Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-5 text-sm">
          <p>
            <span className="text-ink-muted">Subject:</span>{" "}
            {claim.subject.name ?? claim.subject.email}
          </p>
          <p>
            <span className="text-ink-muted">Type:</span> {claim.claimType}
          </p>
          {claim.description ? (
            <p>
              <span className="text-ink-muted">Description:</span> {claim.description}
            </p>
          ) : null}
          {claim.expiresAt ? (
            <p>
              <span className="text-ink-muted">Expires:</span> {claim.expiresAt.toLocaleDateString()}
            </p>
          ) : null}
          {claim.evidenceUrls.length > 0 ? (
            <div>
              <p className="text-ink-muted">Evidence:</p>
              <ul className="list-inside list-disc">
                {claim.evidenceUrls.map((url) => (
                  <li key={url}>
                    <a href={url} className="text-accent underline" target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {claim.status === "SUBMITTED" || claim.status === "IN_REVIEW" ? (
        <Card>
          <CardContent className="p-5">
            <form action={decideAction} className="flex flex-col gap-3">
              <input type="hidden" name="claimId" value={claim.id} />
              <Label htmlFor="notes">Review notes</Label>
              <Textarea id="notes" name="notes" placeholder="Optional notes for the audit trail" />
              <Label htmlFor="expiresAt">Expires (optional, only applied if approved)</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
              <div className="flex flex-wrap gap-2">
                <Button name="decision" value="APPROVED" type="submit">
                  Approve
                </Button>
                <Button name="decision" value="REJECTED" type="submit" variant="danger">
                  Reject
                </Button>
                <Button name="decision" value="REQUEST_MORE_INFO" type="submit" variant="secondary">
                  Request more info
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5">
            <form action={decideAction}>
              <input type="hidden" name="claimId" value={claim.id} />
              <input type="hidden" name="notes" value="Revoked by admin" />
              <Button name="decision" value="REVOKED" type="submit" variant="danger">
                Revoke decision
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">Review history</h2>
        <div className="flex flex-col gap-2">
          {claim.reviews.length === 0 ? (
            <p className="text-sm text-ink-muted">No reviews yet.</p>
          ) : null}
          {claim.reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="flex flex-col gap-1 p-4 text-sm">
                <p className="font-medium text-ink">
                  {review.decision} · {review.reviewer.name ?? review.reviewer.email}
                </p>
                <p className="text-xs text-ink-muted">{review.createdAt.toLocaleString()}</p>
                {review.notes ? <p>{review.notes}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
