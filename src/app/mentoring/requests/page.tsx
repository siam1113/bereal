import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { listMyMentoringOffers, listMyMentoringRequests } from "@/lib/services/mentoring-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WithdrawMentoringRequestButton } from "@/components/learning/mentoring-offer-actions";

export default async function MentoringRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mentoring/requests");

  const [myOffers, myRequests] = await Promise.all([
    listMyMentoringOffers(user.id),
    listMyMentoringRequests(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium text-ink">Mentoring requests</h1>

      <section className="mt-8">
        <h2 className="font-display text-lg font-medium text-ink">Offers you&apos;ve made</h2>
        <div className="mt-3 flex flex-col gap-3">
          {myOffers.length === 0 ? <p className="text-sm text-ink-muted">You haven&apos;t posted a mentoring offer yet.</p> : null}
          {myOffers.map((offer) => (
            <Link key={offer.id} href={`/mentoring/${offer.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-ink">{offer.title}</p>
                    <p className="text-xs text-ink-muted">{offer.skill.name}</p>
                  </div>
                  <Badge variant="outline">{offer._count.requests} requests</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-medium text-ink">Requests you&apos;ve sent</h2>
        <div className="mt-3 flex flex-col gap-3">
          {myRequests.length === 0 ? <p className="text-sm text-ink-muted">No mentoring requests sent yet.</p> : null}
          {myRequests.map((req) => (
            <Card key={req.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-ink">{req.offer.title}</p>
                  <p className="text-xs text-ink-muted">
                    {req.offer.skill.name} · mentor {req.offer.mentor.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{req.status}</Badge>
                  {req.status === "PENDING" ? <WithdrawMentoringRequestButton requestId={req.id} /> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
