"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

const RELATIONSHIP_TYPES = [
  "WORKED_WITH",
  "COLLEAGUE",
  "COLLABORATOR",
  "CLIENT_PROVIDER",
  "MENTOR_MENTEE",
  "CONSULTANT_CLIENT",
  "BUSINESS_PARTNER",
  "FRIEND",
  "FAMILY",
  "LEARNING_FROM",
] as const;

const INTENTS = [
  "WANT_TO_COLLABORATE",
  "SEEK_MENTORSHIP",
  "SEEK_CONSULTATION",
  "INTERESTED_IN_HIRING",
  "WANT_TO_LEARN",
  "SOCIALIZE",
] as const;

export interface RelationshipRequestRow {
  id: string;
  proposedType: string;
  intent: string;
  message: string | null;
  createdAt: string;
  from?: { id: string; name: string | null; email: string } | null;
  to?: { id: string; name: string | null; email: string } | null;
}

export function RequestManager({
  incoming,
  outgoing,
}: {
  incoming: RelationshipRequestRow[];
  outgoing: RelationshipRequestRow[];
}) {
  const router = useRouter();
  const [toUserId, setToUserId] = useState("");
  const [proposedType, setProposedType] = useState<(typeof RELATIONSHIP_TYPES)[number]>("WORKED_WITH");
  const [intent, setIntent] = useState<(typeof INTENTS)[number]>("WANT_TO_COLLABORATE");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function sendRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    try {
      const res = await fetch("/api/relationships/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, proposedType, intent, message: message || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ? JSON.stringify(body.error) : "Couldn't send that request.");
        return;
      }
      toast.success("Relationship request sent.");
      setToUserId("");
      setMessage("");
      router.refresh();
    } finally {
      setIsSending(false);
    }
  }

  async function respond(id: string, accept: boolean) {
    setRespondingId(id);
    try {
      const res = await fetch(`/api/relationships/requests/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      if (!res.ok) {
        toast.error("Couldn't update that request.");
        return;
      }
      toast.success(accept ? "Relationship request accepted." : "Request declined.");
      router.refresh();
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <Card>
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Send a relationship request</h2>
          <p className="mt-1 text-sm text-ink-muted">
            V1 simplification: paste the other person&apos;s user ID directly (full user search
            comes from the Discover vertical).
          </p>
          <form onSubmit={sendRequest} className="mt-4 flex flex-col gap-3">
            <div>
              <Label htmlFor="toUserId">Recipient user ID</Label>
              <Input
                id="toUserId"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Relationship type</Label>
                <Select value={proposedType} onValueChange={(v) => setProposedType(v as typeof proposedType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Intent</Label>
                <Select value={intent} onValueChange={(v) => setIntent(v as typeof intent)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENTS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1" />
            </div>
            <Button type="submit" disabled={isSending} className="self-start">
              {isSending ? "Sending..." : "Send request"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="font-display text-lg font-medium text-ink">Incoming</h2>
        <div className="mt-3 flex flex-col gap-3">
          {incoming.length === 0 ? <p className="text-sm text-ink-muted">No incoming requests.</p> : null}
          {incoming.map((req) => (
            <Card key={req.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium text-ink">
                    {req.from?.name ?? req.from?.email} wants to declare:{" "}
                    {req.proposedType.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-ink-muted">Intent: {req.intent.replace(/_/g, " ")}</p>
                  {req.message ? <p className="mt-1 text-sm text-ink">{req.message}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={respondingId === req.id}
                    onClick={() => respond(req.id, true)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={respondingId === req.id}
                    onClick={() => respond(req.id, false)}
                  >
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-medium text-ink">Outgoing</h2>
        <div className="mt-3 flex flex-col gap-3">
          {outgoing.length === 0 ? <p className="text-sm text-ink-muted">No outgoing requests.</p> : null}
          {outgoing.map((req) => (
            <Card key={req.id}>
              <CardContent className="p-4">
                <p className="font-medium text-ink">
                  To {req.to?.name ?? req.to?.email}: {req.proposedType.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-ink-muted">Waiting for a response.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
