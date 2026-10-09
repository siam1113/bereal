import Link from "next/link";
import { listOpportunities } from "@/lib/services/opportunity-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const KIND_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  MICROTASK: "Microtask",
  APPRENTICESHIP: "Apprenticeship",
  TEAM_PROJECT: "Team project",
};

export default async function OpportunitiesPage() {
  const opportunities = await listOpportunities({});

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">Opportunities</h1>
        <Button asChild>
          <Link href="/opportunities/new">Post an opportunity</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {opportunities.map((op) => (
          <Link key={op.id} href={`/opportunities/${op.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg text-ink">{op.title}</h3>
                  <div className="flex gap-2">
                    {op.kind !== "STANDARD" ? <Badge variant="accent">{KIND_LABELS[op.kind]}</Badge> : null}
                    <Badge variant="accent">{op.type}</Badge>
                    <Badge variant="outline">{op.locationType}</Badge>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-ink-muted">{op.description}</p>
                <p className="text-xs text-ink-muted">
                  {op.business?.name ?? op.postedBy.name} · {op._count.applications} applications
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {opportunities.length === 0 ? <p className="text-ink-muted">No open opportunities yet.</p> : null}
      </div>
    </div>
  );
}
