import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { listMyRelationships } from "@/lib/services/relationship-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATE_VARIANT = {
  ACTIVE: "success",
  PAST: "outline",
  PROPOSED: "warning",
  PLANNED: "neutral",
} as const;

const CONFIRMATION_LABEL = {
  SELF_DECLARED: "Self-declared",
  MUTUALLY_CONFIRMED: "Mutually confirmed",
  EVIDENCE_REVIEWED: "Evidence reviewed",
} as const;

export default async function RelationshipsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/relationships");

  const relationships = await listMyRelationships(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">Relationships</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every tie you&apos;ve declared or had declared with you, with its own confirmation
            state and visibility.
          </p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/relationships/requests">Requests</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {relationships.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-ink-muted">
              No relationships yet. Send a relationship request from the requests page to get
              started.
            </CardContent>
          </Card>
        ) : null}

        {relationships.map((rel) => {
          const counterpart = rel.partyAUserId === user.id ? rel.partyB : rel.partyA;
          const isDeclarer = rel.declaredByUserId === user.id;
          const hasOpenDispute = rel.disputes.length > 0;

          return (
            <Link key={rel.id} href={`/relationships/${rel.id}`}>
              <Card className="transition-colors hover:border-border-strong">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-ink">{counterpart?.name ?? "Unknown"}</p>
                    <p className="text-xs text-ink-muted">
                      {rel.type.replace(/_/g, " ")} ·{" "}
                      {CONFIRMATION_LABEL[rel.confirmationStatus]}
                      {isDeclarer ? " (declared by you)" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasOpenDispute ? <Badge variant="danger">Disputed</Badge> : null}
                    <Badge variant={STATE_VARIANT[rel.state]}>{rel.state}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
