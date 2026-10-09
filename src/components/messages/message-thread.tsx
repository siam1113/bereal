"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";

interface ThreadMessage {
  id: string;
  content: string;
  createdAt: string | Date;
  senderUserId: string;
}

export function MessageThread({
  conversationId,
  initialMessages,
  viewerUserId,
}: {
  conversationId: string;
  initialMessages: ThreadMessage[];
  viewerUserId: string;
}) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [initialMessages.length]);

  async function handleSend() {
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not send message");
      }
      setContent("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border border-border bg-surface">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          {initialMessages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                m.senderUserId === viewerUserId
                  ? "ml-auto bg-accent text-accent-foreground"
                  : "bg-accent-soft text-ink",
              )}
            >
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a message..."
          maxLength={4000}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <Button onClick={handleSend} disabled={sending || !content.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
