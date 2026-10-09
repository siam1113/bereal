"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

export function RequestMentoringForm({ offerId, disabled }: { offerId: string; disabled: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (disabled) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch(`/api/mentoring-offers/${offerId}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message || undefined }),
    });
    setSubmitting(false);
    if (res.ok) {
      setMessage("");
      toast.success("Request sent.");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error ?? "Could not send your request.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Textarea
        placeholder="Say a bit about what you're hoping to learn (optional)..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Sending..." : "Request mentoring"}
      </Button>
    </form>
  );
}

interface MentoringRequestRow {
  id: string;
  message: string | null;
  status: string;
  mentee: { name: string | null; personProfile: { slug: string; displayName: string } | null };
}

export function MentoringRequestManager({ requests }: { requests: MentoringRequestRow[] }) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);

  async function act(id: string, action: "accept" | "decline") {
    setActingId(id);
    try {
      const res = await fetch(`/api/mentoring-requests/${id}/${action}`, { method: "POST" });
      if (res.ok) {
        toast.success(action === "accept" ? "Request accepted." : "Request declined.");
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Could not update that request.");
      }
    } finally {
      setActingId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING");

  return (
    <div className="flex flex-col gap-3">
      {pending.length === 0 ? <p className="text-sm text-ink-muted">No pending requests.</p> : null}
      {pending.map((r) => (
        <div key={r.id} className="flex flex-col gap-2 rounded-md border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">
              {r.mentee.personProfile?.displayName ?? r.mentee.name}
            </span>
            <Badge variant="outline">{r.status}</Badge>
          </div>
          {r.message ? <p className="text-sm text-ink-muted">{r.message}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={actingId === r.id} onClick={() => act(r.id, "accept")}>
              Accept
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={actingId === r.id}
              onClick={() => act(r.id, "decline")}
            >
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WithdrawMentoringRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setSubmitting(true);
    const res = await fetch(`/api/mentoring-requests/${requestId}/withdraw`, { method: "POST" });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Request withdrawn.");
      router.refresh();
    } else {
      toast.error("Could not withdraw that request.");
    }
  }

  return (
    <Button size="sm" variant="ghost" disabled={submitting} onClick={onClick}>
      Withdraw
    </Button>
  );
}
