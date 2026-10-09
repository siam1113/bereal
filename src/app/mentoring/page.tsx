import Link from "next/link";
import { listMentoringOffers } from "@/lib/services/mentoring-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FORMAT_LABEL: Record<string, string> = {
  ONE_ON_ONE: "One-on-one",
  GROUP: "Group",
  EITHER: "One-on-one or group",
};

export default async function MentoringPage() {
  const offers = await listMentoringOffers({});

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">Mentoring</h1>
          <p className="mt-1 text-ink-muted">
            People offering to mentor others — a mutual counterpart to self-declared
            &quot;learning from&quot; links. Offers come from every professional stage; an
            Emerging mentor offering peer mentoring is as legitimate as an Established one.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/expert-sessions">Expert sessions</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/mentoring/requests">My requests</Link>
          </Button>
          <Button asChild>
            <Link href="/mentoring/new">Offer to mentor</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {offers.map((offer) => (
          <Link key={offer.id} href={`/mentoring/${offer.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 p-5">
                <h3 className="font-display text-lg text-ink">{offer.title}</h3>
                <p className="line-clamp-2 text-sm text-ink-muted">{offer.description}</p>
                <p className="text-xs text-ink-muted">
                  {offer.mentor.personProfile?.displayName ?? offer.mentor.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">{offer.skill.name}</Badge>
                  <Badge variant="outline">{FORMAT_LABEL[offer.format]}</Badge>
                  <Badge variant="outline">Capacity {offer.capacity}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {offers.length === 0 ? <p className="text-ink-muted">No open mentoring offers yet.</p> : null}
      </div>
    </div>
  );
}
