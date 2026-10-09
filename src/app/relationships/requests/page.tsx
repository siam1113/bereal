import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { listMyRelationshipRequests } from "@/lib/services/relationship-service";
import { RequestManager } from "./request-manager";

export default async function RelationshipRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/relationships/requests");

  const { incoming, outgoing } = await listMyRelationshipRequests(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium text-ink">Relationship requests</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Accepting creates a self-declared relationship — the other party still has to confirm
        it actually happened before it counts as mutually confirmed.
      </p>

      <RequestManager
        incoming={incoming.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
        outgoing={outgoing.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
