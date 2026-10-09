import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { RelationshipAuthError } from "@/lib/services/relationship-service";
import { getReferenceDetail } from "@/lib/services/reference-service";
import { ReferenceDetailManager } from "./reference-detail-manager";

export default async function ReferenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/references");

  const { id } = await params;

  let reference;
  try {
    reference = await getReferenceDetail(id, user.id);
  } catch (err) {
    if (err instanceof RelationshipAuthError) notFound();
    throw err;
  }
  if (!reference) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium text-ink">Reference detail</h1>
      <ReferenceDetailManager
        currentUserId={user.id}
        reference={{
          id: reference.id,
          status: reference.status,
          visibility: reference.visibility,
          comment: reference.comment,
          attributes: reference.attributes as Record<string, unknown>,
          author: reference.author,
          subject: reference.subject,
          relationship: { type: reference.relationship.type },
          disputes: reference.disputes.map((d) => ({
            id: d.id,
            reason: d.reason,
            status: d.status,
            createdAt: d.createdAt.toISOString(),
          })),
        }}
      />
    </div>
  );
}
