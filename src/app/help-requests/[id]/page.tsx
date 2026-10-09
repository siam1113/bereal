import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getHelpRequest } from "@/lib/services/help-request-service";
import { Badge } from "@/components/ui/badge";
import { RespondForm, ResponseRow, RequestStatusControl } from "@/components/discover/help-request-actions";

export default async function HelpRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [helpRequest, session] = await Promise.all([getHelpRequest(id), auth()]);
  if (!helpRequest) notFound();

  const currentUserId = session?.user?.id ?? null;
  const isAuthor = currentUserId === helpRequest.authorUserId;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">{helpRequest.title}</h1>
        <Badge variant="outline">{helpRequest.geoScope}</Badge>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        Posted by {helpRequest.author.name}
        {helpRequest.skill ? ` · ${helpRequest.skill.name}` : ""}
      </p>
      <p className="mt-4 whitespace-pre-wrap text-ink">{helpRequest.description}</p>

      {isAuthor ? (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Status</h2>
          <RequestStatusControl helpRequestId={helpRequest.id} currentStatus={helpRequest.status} />
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="font-display text-xl text-ink">Responses</h2>
        <div className="mt-4 flex flex-col gap-3">
          {helpRequest.responses.map((r) => (
            <ResponseRow
              key={r.id}
              response={r}
              isAuthor={isAuthor}
            />
          ))}
          {helpRequest.responses.length === 0 ? (
            <p className="text-sm text-ink-muted">No responses yet.</p>
          ) : null}
        </div>
      </div>

      {!isAuthor ? (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Offer to help</h2>
          <RespondForm helpRequestId={helpRequest.id} disabled={!currentUserId} />
          {!currentUserId ? <p className="mt-2 text-sm text-ink-muted">Sign in to respond.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
