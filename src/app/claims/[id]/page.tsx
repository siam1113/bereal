import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getMyClaimDetail } from "@/lib/services/claim-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClaimAppealForm } from "./claim-appeal-form";

const APPEALABLE_STATUSES = new Set(["REJECTED", "REVOKED"]);

const STATUS_VARIANT = {
  SUBMITTED: "warning",
  IN_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REVOKED: "danger",
} as const;

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/claims");

  const { id } = await params;
  const claim = await getMyClaimDetail(id, user.id);
  if (!claim) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-ink">{claim.title}</h1>
        <Badge variant={STATUS_VARIANT[claim.status]}>{claim.status.replace(/_/g, " ")}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-muted">{claim.claimType.replace(/_/g, " ")}</p>

      {claim.description ? <p className="mt-4 text-ink">{claim.description}</p> : null}

      {claim.evidenceUrls.length > 0 ? (
        <div className="mt-4">
          <h2 className="text-sm font-medium text-ink">Evidence</h2>
          <ul className="mt-1 list-inside list-disc text-sm text-accent">
            {claim.evidenceUrls.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" className="underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <h2 className="font-display text-lg font-medium text-ink">Review history</h2>
        <div className="mt-3 flex flex-col gap-3">
          {claim.reviews.length === 0 ? (
            <p className="text-sm text-ink-muted">Not yet reviewed.</p>
          ) : (
            claim.reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-ink">{review.decision.replace(/_/g, " ")}</p>
                  {review.notes ? <p className="mt-1 text-sm text-ink-muted">{review.notes}</p> : null}
                  <p className="mt-1 text-xs text-ink-muted">{review.createdAt.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-lg font-medium text-ink">Appeals</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Contest a rejected or revoked decision — an admin reviews every appeal; appealing
          doesn&apos;t change the claim&apos;s status by itself.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {claim.appeals.length === 0 ? (
            <p className="text-sm text-ink-muted">No appeals filed.</p>
          ) : (
            claim.appeals.map((appeal) => (
              <Card key={appeal.id}>
                <CardContent className="p-4">
                  <Badge variant={appeal.status.startsWith("RESOLVED") ? "neutral" : "warning"}>
                    {appeal.status}
                  </Badge>
                  <p className="mt-1 text-sm text-ink">{appeal.reason}</p>
                  {appeal.resolutionNotes ? (
                    <p className="mt-1 text-sm text-ink-muted">{appeal.resolutionNotes}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
        {APPEALABLE_STATUSES.has(claim.status) &&
        !claim.appeals.some((a) => a.status === "OPEN" || a.status === "UNDER_REVIEW") ? (
          <ClaimAppealForm claimId={claim.id} />
        ) : null}
      </div>
    </div>
  );
}
