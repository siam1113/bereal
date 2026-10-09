import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { auth } from "@/lib/auth";
import { listNotifications } from "@/lib/services/notification-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";

const TYPE_LABELS: Record<string, string> = {
  RELATIONSHIP_REQUEST: "New relationship request",
  RELATIONSHIP_CONFIRMED: "Relationship confirmed",
  RELATIONSHIP_DISPUTED: "Relationship disputed",
  ENDORSEMENT_RECEIVED: "New endorsement",
  FEEDBACK_RECEIVED: "New professional feedback",
  CLAIM_DECISION: "Claim decision",
  BADGE_AWARDED: "Badge awarded",
  POST_COMMENT: "New comment on your post",
  POST_REACTION: "New reaction on your post",
  NEW_FOLLOWER: "New follower",
  HELP_RESPONSE: "New response to your help request",
  APPLICATION_UPDATE: "Application update",
  INQUIRY_RECEIVED: "New inquiry",
  NEW_MESSAGE: "New message",
  MODERATION_UPDATE: "Moderation update",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/notifications");

  const notifications = await listNotifications(session.user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-ink">Notifications</h1>
        <MarkAllReadButton />
      </div>
      <div className="flex flex-col gap-2">
        {notifications.length === 0 ? (
          <p className="text-sm text-ink-muted">You&apos;re all caught up.</p>
        ) : (
          notifications.map((n) => (
            <Card key={n.id} className={n.isRead ? "opacity-70" : undefined}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-ink">{TYPE_LABELS[n.type] ?? n.type}</p>
                  <p className="text-xs text-ink-muted">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!n.isRead ? <Badge variant="accent">New</Badge> : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
