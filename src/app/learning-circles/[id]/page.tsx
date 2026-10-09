import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getLearningCircle } from "@/lib/services/learning-circle-service";
import { Badge } from "@/components/ui/badge";
import {
  CircleMemberManager,
  JoinCircleButton,
  LeaveCircleButton,
} from "@/components/learning/learning-circle-actions";

export default async function LearningCircleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [circle, user] = await Promise.all([getLearningCircle(id), getCurrentUser()]);
  if (!circle) notFound();

  const myMembership = user ? circle.memberships.find((m) => m.userId === user.id) : undefined;
  const isActiveOrganizer = myMembership?.role === "ORGANIZER" && myMembership.status === "ACTIVE";
  const activeMembers = circle.memberships.filter((m) => m.status === "ACTIVE");
  const isFull = activeMembers.length >= circle.capacity;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">{circle.title}</h1>
        {!circle.isActive ? <Badge variant="outline">Inactive</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-ink-muted">Started by {circle.creator.name}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {circle.skill ? <Badge variant="neutral">{circle.skill.name}</Badge> : null}
        <Badge variant="outline">{circle.geoScope}</Badge>
        <Badge variant="outline">
          {activeMembers.length}/{circle.capacity} members
        </Badge>
      </div>
      {circle.description ? <p className="mt-4 whitespace-pre-wrap text-ink">{circle.description}</p> : null}

      <div className="mt-6">
        {!user ? (
          <p className="text-sm text-ink-muted">Sign in to request to join.</p>
        ) : myMembership ? (
          <div className="flex items-center gap-3">
            <Badge variant="outline">Your status: {myMembership.status}</Badge>
            {myMembership.status === "ACTIVE" ? (
              <LeaveCircleButton circleId={circle.id} userId={user.id} />
            ) : null}
          </div>
        ) : (
          <JoinCircleButton circleId={circle.id} disabled={!circle.isActive || isFull} />
        )}
        {!myMembership && isFull ? <p className="mt-2 text-sm text-ink-muted">This circle is full.</p> : null}
      </div>

      <div className="mt-8">
        <h2 className="font-display text-xl text-ink">Members</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {activeMembers.map((m) => (
            <li key={m.userId} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm text-ink">{m.user.name}</span>
              <Badge variant="outline">{m.role}</Badge>
            </li>
          ))}
        </ul>
      </div>

      {isActiveOrganizer ? (
        <div className="mt-8">
          <h2 className="font-display text-xl text-ink">Join requests</h2>
          <div className="mt-3">
            <CircleMemberManager
              circleId={circle.id}
              members={circle.memberships.map((m) => ({
                userId: m.userId,
                role: m.role,
                status: m.status,
                user: m.user,
              }))}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
