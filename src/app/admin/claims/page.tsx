import Link from "next/link";
import { listClaims } from "@/lib/services/admin-claim-review-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminClaimsPage() {
  const claims = await listClaims();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-ink">Claim review queue</h1>
      <div className="flex flex-col gap-3">
        {claims.length === 0 ? (
          <p className="text-sm text-ink-muted">No claims waiting on review.</p>
        ) : null}
        {claims.map((claim) => (
          <Link key={claim.id} href={`/admin/claims/${claim.id}`}>
            <Card className="transition-colors hover:border-border-strong">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink">{claim.title}</p>
                  <p className="text-xs text-ink-muted">
                    {claim.claimType} · {claim.subject.name ?? claim.subject.email}
                  </p>
                </div>
                <Badge variant={claim.status === "IN_REVIEW" ? "warning" : "neutral"}>
                  {claim.status}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
