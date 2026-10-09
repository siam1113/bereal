import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { RelationshipAuthError, getRelationshipDetail } from "@/lib/services/relationship-service";
import { RelationshipDetailManager } from "./relationship-detail-manager";

export default async function RelationshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/relationships");

  const { id } = await params;

  let rel;
  try {
    rel = await getRelationshipDetail(id, user.id);
  } catch (err) {
    if (err instanceof RelationshipAuthError) notFound();
    throw err;
  }
  if (!rel) notFound();

  const myVisibility = rel.visibilities.find((v) => v.userId === user.id) ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium text-ink">Relationship detail</h1>
      <RelationshipDetailManager
        currentUserId={user.id}
        relationship={{
          id: rel.id,
          type: rel.type,
          state: rel.state,
          confirmationStatus: rel.confirmationStatus,
          declaredByUserId: rel.declaredByUserId,
          counterpartConsent: rel.counterpartConsent,
          partyA: rel.partyA,
          partyB: rel.partyB,
          evidence: rel.evidence.map((e) => ({
            id: e.id,
            description: e.description,
            url: e.url,
            createdAt: e.createdAt.toISOString(),
          })),
          disputes: rel.disputes.map((d) => ({
            id: d.id,
            reason: d.reason,
            status: d.status,
            createdAt: d.createdAt.toISOString(),
          })),
          myVisibility: myVisibility ? { visibility: myVisibility.visibility, hidden: myVisibility.hidden } : null,
        }}
      />
    </div>
  );
}
