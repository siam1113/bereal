"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

interface Response {
  id: string;
  message: string;
  status: string;
  responder: { name: string | null; personProfile: { slug: string } | null };
}

export function RespondForm({ helpRequestId, disabled }: { helpRequestId: string; disabled: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch(`/api/help-requests/${helpRequestId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setSubmitting(false);
    if (res.ok) {
      setMessage("");
      router.refresh();
    } else {
      toast.error("Sign in to respond to this request.");
    }
  }

  if (disabled) return null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Textarea
        placeholder="Describe how you can help..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Sending..." : "Respond"}
      </Button>
    </form>
  );
}

export function ResponseRow({
  response,
  isAuthor,
}: {
  response: Response;
  isAuthor: boolean;
}) {
  const router = useRouter();

  async function setStatus(status: string) {
    const res = await fetch(`/api/help-responses/${response.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) router.refresh();
    else toast.error("Could not update status.");
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{response.responder.name}</span>
        <Badge variant="outline">{response.status}</Badge>
      </div>
      <p className="text-sm text-ink-muted">{response.message}</p>
      {isAuthor ? (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setStatus("SHORTLISTED")}>
            Shortlist
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setStatus("ACCEPTED")}>
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStatus("DECLINED")}>
            Decline
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function RequestStatusControl({ helpRequestId, currentStatus }: { helpRequestId: string; currentStatus: string }) {
  const router = useRouter();
  const statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

  async function setStatus(status: string) {
    const res = await fetch(`/api/help-requests/${helpRequestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) router.refresh();
    else toast.error("Could not update status.");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((s) => (
        <Button
          key={s}
          size="sm"
          variant={s === currentStatus ? "primary" : "secondary"}
          onClick={() => setStatus(s)}
        >
          {s}
        </Button>
      ))}
    </div>
  );
}
