import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getExpertSession } from "@/lib/services/expert-session-service";
import { Badge } from "@/components/ui/badge";
import { BookSessionButton, CancelSessionButton } from "@/components/learning/expert-session-actions";

export default async function ExpertSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, user] = await Promise.all([getExpertSession(id), getCurrentUser()]);
  if (!session) notFound();

  const isHost = user?.id === session.hostUserId;
  const myBooking = user ? session.bookings.find((b) => b.attendeeUserId === user.id) : undefined;
  const isFull = session.bookings.length >= session.capacity;
  const isCancelled = session.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">{session.title}</h1>
        <Badge variant={isCancelled ? "danger" : "outline"}>{session.status}</Badge>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        Hosted by{" "}
        {session.host.personProfile ? (
          <Link href={`/p/${session.host.personProfile.slug}`} className="underline">
            {session.host.personProfile.displayName}
          </Link>
        ) : (
          session.host.name
        )}
        {session.skill ? ` · ${session.skill.name}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="neutral">
          {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(session.startsAt)}
          {" – "}
          {new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(session.endsAt)}
        </Badge>
        <Badge variant="outline">{session.locationType}</Badge>
        <Badge variant="outline">
          {session.bookings.length}/{session.capacity} booked
        </Badge>
      </div>
      {session.description ? <p className="mt-4 whitespace-pre-wrap text-ink">{session.description}</p> : null}
      {session.locationNote ? (
        <p className="mt-2 text-sm text-ink-muted">Location note: {session.locationNote}</p>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        {isHost ? (
          !isCancelled ? <CancelSessionButton sessionId={session.id} /> : null
        ) : (
          <BookSessionButton
            sessionId={session.id}
            disabled={!user || isCancelled || (isFull && !myBooking)}
            alreadyBooked={!!myBooking}
          />
        )}
        {!user ? <p className="text-sm text-ink-muted">Sign in to book this session.</p> : null}
        {user && !isHost && isFull && !myBooking ? (
          <p className="text-sm text-ink-muted">This session is fully booked.</p>
        ) : null}
      </div>
    </div>
  );
}
