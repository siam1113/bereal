"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
            <MessageBubble key={m.id} message={m} isOwn={m.senderUserId === viewerUserId} />
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

interface TranslationState {
  translatedText: string | null;
  available: boolean;
  label: string;
}

/**
 * Translation assistance for display (docs/roadmap/08-ai-assistance.md "What to build"
 * item 4): on demand, per message, never auto-triggered. Only offered for the
 * counterpart's messages — translating your own sent message isn't the use case.
 * Always keeps the original text visible and clearly labels the translation; see
 * src/lib/services/ai-translation-service.ts for why this honestly reports
 * "unavailable" rather than a translation while the external provider is disabled
 * (the default).
 */
function MessageBubble({ message, isOwn }: { message: ThreadMessage; isOwn: boolean }) {
  const [translation, setTranslation] = useState<TranslationState | null>(null);
  const [translating, setTranslating] = useState(false);

  async function handleTranslate() {
    setTranslating(true);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content, targetLocale: "en" }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setTranslation(data.result);
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div
      className={cn(
        "flex max-w-[75%] flex-col gap-1",
        isOwn ? "ml-auto items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm",
          isOwn ? "bg-accent text-accent-foreground" : "bg-accent-soft text-ink",
        )}
      >
        {message.content}
      </div>
      {!isOwn ? (
        <button
          type="button"
          onClick={handleTranslate}
          disabled={translating}
          className="text-xs text-ink-muted underline-offset-2 hover:underline"
        >
          {translating ? "Translating…" : "Translate"}
        </button>
      ) : null}
      {translation ? (
        <div className="rounded-md border border-dashed border-accent bg-accent-soft px-3 py-2 text-xs text-ink">
          <div className="mb-1 flex items-center gap-1.5">
            <Badge variant="outline">AI translation</Badge>
            <span className="text-ink-muted">{translation.label}</span>
          </div>
          {translation.translatedText ? <p>{translation.translatedText}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
