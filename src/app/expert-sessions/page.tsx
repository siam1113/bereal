import Link from "next/link";
import { listExpertSessions } from "@/lib/services/expert-session-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatRange(startsAt: Date, endsAt: Date) {
  const sameDay = startsAt.toDateString() === endsAt.toDateString();
  const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  const timeFmt = new Intl.DateTimeFormat("en", { timeStyle: "short" });
  return sameDay
    ? `${dateFmt.format(startsAt)} · ${timeFmt.format(startsAt)}–${timeFmt.format(endsAt)}`
    : `${dateFmt.format(startsAt)} – ${dateFmt.format(endsAt)}`;
}

export default async function ExpertSessionsPage() {
  const sessions = await listExpertSessions({ upcomingOnly: true });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">Expert sessions</h1>
          <p className="mt-1 text-ink-muted">Bookable, time-boxed sessions. No payment in V1 — just a reservation.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/expert-sessions/mine">My sessions</Link>
          </Button>
          <Button asChild>
            <Link href="/expert-sessions/new">Host a session</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {sessions.map((session) => (
          <Link key={session.id} href={`/expert-sessions/${session.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg text-ink">{session.title}</h3>
                  <Badge variant="outline">
                    {session._count.bookings}/{session.capacity} booked
                  </Badge>
                </div>
                <p className="text-sm text-ink-muted">{formatRange(session.startsAt, session.endsAt)}</p>
                <p className="text-xs text-ink-muted">
                  Hosted by {session.host.personProfile?.displayName ?? session.host.name}
                  {session.skill ? ` · ${session.skill.name}` : ""}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {sessions.length === 0 ? <p className="text-ink-muted">No upcoming sessions yet.</p> : null}
      </div>
    </div>
  );
}
