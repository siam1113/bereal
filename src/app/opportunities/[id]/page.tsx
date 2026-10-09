import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOpportunity } from "@/lib/services/opportunity-service";
import { Badge } from "@/components/ui/badge";
import { ApplyForm, ApplicationRow, OpportunityStatusControl } from "@/components/discover/opportunity-actions";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [opportunity, session] = await Promise.all([getOpportunity(id), auth()]);
  if (!opportunity) notFound();

  const currentUserId = session?.user?.id ?? null;
  const isPoster = currentUserId === opportunity.postedByUserId;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">{opportunity.title}</h1>
        <div className="flex gap-2">
          <Badge variant="accent">{opportunity.type}</Badge>
          <Badge variant="outline">{opportunity.locationType}</Badge>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        Posted by {opportunity.business?.name ?? opportunity.postedBy.name}
        {opportunity.skill ? ` · ${opportunity.skill.name}` : ""}
      </p>
      <p className="mt-4 whitespace-pre-wrap text-ink">{opportunity.description}</p>

      {isPoster ? (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Status</h2>
          <OpportunityStatusControl opportunityId={opportunity.id} currentStatus={opportunity.status} />
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="font-display text-xl text-ink">Applications</h2>
        <div className="mt-4 flex flex-col gap-3">
          {opportunity.applications.map((a) => (
            <ApplicationRow key={a.id} application={a} isPoster={isPoster} />
          ))}
          {opportunity.applications.length === 0 ? (
            <p className="text-sm text-ink-muted">No applications yet.</p>
          ) : null}
        </div>
      </div>

      {!isPoster ? (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Apply</h2>
          <ApplyForm opportunityId={opportunity.id} disabled={!currentUserId} />
          {!currentUserId ? <p className="mt-2 text-sm text-ink-muted">Sign in to apply.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
