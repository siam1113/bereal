import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { listMyBookings, listMyHostedSessions } from "@/lib/services/expert-session-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MyExpertSessionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/expert-sessions/mine");

  const [hosted, booked] = await Promise.all([listMyHostedSessions(user.id), listMyBookings(user.id)]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium text-ink">My expert sessions</h1>

      <section className="mt-8">
        <h2 className="font-display text-lg font-medium text-ink">Sessions you host</h2>
        <div className="mt-3 flex flex-col gap-3">
          {hosted.length === 0 ? <p className="text-sm text-ink-muted">You haven&apos;t hosted a session yet.</p> : null}
          {hosted.map((s) => (
            <Link key={s.id} href={`/expert-sessions/${s.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-ink">{s.title}</p>
                    <p className="text-xs text-ink-muted">
                      {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(s.startsAt)}
                    </p>
                  </div>
                  <Badge variant="outline">{s.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-medium text-ink">Sessions you&apos;ve booked</h2>
        <div className="mt-3 flex flex-col gap-3">
          {booked.length === 0 ? <p className="text-sm text-ink-muted">No bookings yet.</p> : null}
          {booked.map((b) => (
            <Link key={b.id} href={`/expert-sessions/${b.session.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-ink">{b.session.title}</p>
                    <p className="text-xs text-ink-muted">
                      {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
                        b.session.startsAt,
                      )}
                    </p>
                  </div>
                  <Badge variant="outline">{b.session.host.name}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
