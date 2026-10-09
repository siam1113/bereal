import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { auth } from "@/lib/auth";
import { listConversations } from "@/lib/services/message-service";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/messages");

  const conversations = await listConversations(session.user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-medium text-ink">Messages</h1>
      <div className="flex flex-col gap-2">
        {conversations.length === 0 ? (
          <p className="text-sm text-ink-muted">No conversations yet.</p>
        ) : (
          conversations.map((c) => {
            const other = c.otherParticipants[0];
            const name = other?.personProfile?.displayName ?? other?.name ?? "Unknown";
            return (
              <Link key={c.id} href={`/messages/${c.id}`}>
                <Card className="transition-colors hover:bg-accent-soft/40">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Avatar>
                      {other?.image ? <AvatarImage src={other.image} alt={name} /> : null}
                      <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-ink">{name}</p>
                      <p className="truncate text-sm text-ink-muted">
                        {c.lastMessage?.content ?? "No messages yet"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {c.lastMessage ? (
                        <span className="text-xs text-ink-muted">
                          {formatDistanceToNow(new Date(c.lastMessage.createdAt), { addSuffix: true })}
                        </span>
                      ) : null}
                      {c.unread ? <Badge variant="accent">New</Badge> : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
