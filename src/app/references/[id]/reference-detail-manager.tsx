"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

export interface ReferenceDetailData {
  id: string;
  status: "SUBMITTED" | "DISPUTED" | "REVOKED";
  visibility: "PUBLIC" | "CONNECTIONS" | "PRIVATE";
  comment: string | null;
  attributes: Record<string, unknown>;
  author: { id: string; name: string | null };
  subject: { id: string; name: string | null };
  relationship: { type: string };
  disputes: { id: string; reason: string; status: string; createdAt: string }[];
}

export function ReferenceDetailManager({
  reference,
  currentUserId,
}: {
  reference: ReferenceDetailData;
  currentUserId: string;
}) {
  const router = useRouter();
  const isSubject = reference.subject.id === currentUserId;

  const [busy, setBusy] = useState(false);
  const [visibility, setVisibility] = useState(reference.visibility);
  const [disputeReason, setDisputeReason] = useState("");

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  async function saveVisibility() {
    await withBusy(async () => {
      const res = await fetch(`/api/references/${reference.id}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (!res.ok) {
        toast.error("Couldn't update visibility.");
        return;
      }
      toast.success("Visibility updated.");
      router.refresh();
    });
  }

  async function dispute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withBusy(async () => {
      const res = await fetch(`/api/references/${reference.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: disputeReason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Couldn't file a dispute.");
        return;
      }
      toast.success("Dispute filed. An admin will review it.");
      setDisputeReason("");
      router.refresh();
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-display text-xl text-ink">
              {reference.author.name ?? "Someone"} → {reference.subject.name ?? "Someone"}
            </p>
            <p className="text-sm text-ink-muted">{reference.relationship.type.replace(/_/g, " ")}</p>
          </div>
          <Badge
            variant={
              reference.status === "SUBMITTED" ? "success" : reference.status === "DISPUTED" ? "warning" : "danger"
            }
          >
            {reference.status}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2 p-5 text-sm">
          {Object.entries(reference.attributes).map(([key, value]) => (
            <p key={key}>
              <span className="text-ink-muted">{key}:</span> {String(value)}
            </p>
          ))}
          {reference.comment ? <p className="mt-2 text-ink">{reference.comment}</p> : null}
        </CardContent>
      </Card>

      {isSubject ? (
        <Card>
          <CardContent className="p-5">
            <h2 className="font-display text-lg font-medium text-ink">Your visibility</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Only you control whether this reference shows on your profile.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="CONNECTIONS">Connections</SelectItem>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" disabled={busy} onClick={saveVisibility}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isSubject ? (
        <Card>
          <CardContent className="p-5">
            <h2 className="font-display text-lg font-medium text-ink">Disputes</h2>
            <div className="mt-3 flex flex-col gap-2">
              {reference.disputes.length === 0 ? (
                <p className="text-sm text-ink-muted">No disputes.</p>
              ) : (
                reference.disputes.map((d) => (
                  <div key={d.id} className="rounded-md border border-border p-3 text-sm">
                    <Badge variant={d.status.startsWith("RESOLVED") ? "neutral" : "danger"}>{d.status}</Badge>
                    <p className="mt-1 text-ink">{d.reason}</p>
                  </div>
                ))
              )}
            </div>
            {reference.status !== "REVOKED" ? (
              <form onSubmit={dispute} className="mt-4 flex flex-col gap-2">
                <Textarea
                  placeholder="Why are you disputing this reference?"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  required
                />
                <Button type="submit" size="sm" variant="danger" disabled={busy} className="self-start">
                  File a dispute
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
