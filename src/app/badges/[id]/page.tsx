import { notFound } from "next/navigation";
import { getBadgeAwardDetail } from "@/lib/services/badge-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function BadgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const award = await getBadgeAwardDetail(id);
  if (!award) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-ink">{award.badgeDefinition.name}</h1>
        <Badge variant={award.status === "ACTIVE" ? "success" : "danger"}>{award.status}</Badge>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{award.badgeDefinition.description}</p>

      <Card className="mt-6">
        <CardContent className="flex flex-col gap-2 p-5 text-sm text-ink">
          <p>
            <span className="text-ink-muted">Awarded to: </span>
            {award.recipient.name ?? "Unknown"}
          </p>
          <p>
            <span className="text-ink-muted">Issued by: </span>
            {award.issuer?.name ?? "COMMON (system)"}
          </p>
          <p>
            <span className="text-ink-muted">Date: </span>
            {award.issuedAt.toLocaleDateString()}
          </p>
          {award.status === "REVOKED" ? (
            <p className="text-danger">
              Revoked{award.revokedAt ? ` on ${award.revokedAt.toLocaleDateString()}` : ""}
              {award.revokedReason ? `: ${award.revokedReason}` : ""}
            </p>
          ) : null}
          <p className="text-xs text-ink-muted">
            This badge represents a specific verified claim or feedback-derived attribute — not
            a blanket claim of quality.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
