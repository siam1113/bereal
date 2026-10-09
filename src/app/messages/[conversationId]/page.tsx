import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getConversationForUser } from "@/lib/services/message-service";
import { MessageThread } from "@/components/messages/message-thread";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/messages");

  const { conversationId } = await params;

  let conversation;
  try {
    conversation = await getConversationForUser(conversationId, session.user.id);
  } catch {
    notFound();
  }

  const other = conversation.participants.find((p) => p.userId !== session.user.id)?.user;
  const otherName = other?.personProfile?.displayName ?? other?.name ?? "Unknown";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/messages" className="text-sm text-accent hover:underline">
        ← All messages
      </Link>
      <h1 className="mb-6 mt-2 font-display text-2xl font-medium text-ink">{otherName}</h1>
      <MessageThread
        conversationId={conversation.id}
        viewerUserId={session.user.id}
        initialMessages={conversation.messages}
      />
    </div>
  );
}
