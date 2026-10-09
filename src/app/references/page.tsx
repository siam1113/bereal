import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { listReferencesAuthored, listReferencesReceived } from "@/lib/services/reference-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT = {
  SUBMITTED: "success",
  DISPUTED: "warning",
  REVOKED: "danger",
} as const;

export default async function ReferencesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/references");

  const [received, given] = await Promise.all([
    listReferencesReceived(user.id),
    listReferencesAuthored(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium text-ink">References</h1>
      <p className="mt-1 text-sm text-ink-muted">
        A reference is a structured assessment someone with a mutually confirmed relationship
        with you has left — a stronger tier than an endorsement, but still evidence for a human
        review, never an automatic trust score or stage change.
      </p>

      <section className="mt-6">
        <h2 className="font-display text-lg font-medium text-ink">Received</h2>
        <div className="mt-3 flex flex-col gap-3">
          {received.length === 0 ? (
            <p className="text-sm text-ink-muted">No references received yet.</p>
          ) : null}
          {received.map((ref) => (
            <Link key={ref.id} href={`/references/${ref.id}`}>
              <Card className="transition-colors hover:border-border-strong">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-ink">From {ref.author.name ?? "someone"}</p>
                    <p className="text-xs text-ink-muted">
                      {ref.relationship.type.replace(/_/g, " ")} · {ref.visibility}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[ref.status]}>{ref.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-medium text-ink">Given</h2>
        <div className="mt-3 flex flex-col gap-3">
          {given.length === 0 ? (
            <p className="text-sm text-ink-muted">
              You haven&apos;t written a reference yet — you can from a mutually confirmed
              relationship&apos;s detail page.
            </p>
          ) : null}
          {given.map((ref) => (
            <Link key={ref.id} href={`/references/${ref.id}`}>
              <Card className="transition-colors hover:border-border-strong">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-ink">About {ref.subject.name ?? "someone"}</p>
                    <p className="text-xs text-ink-muted">{ref.relationship.type.replace(/_/g, " ")}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[ref.status]}>{ref.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
