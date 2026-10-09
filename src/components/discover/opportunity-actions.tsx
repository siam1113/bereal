"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

interface Application {
  id: string;
  coverMessage: string | null;
  status: string;
  applicant: { name: string | null };
}

export function ApplyForm({ opportunityId, disabled }: { opportunityId: string; disabled: boolean }) {
  const router = useRouter();
  const [coverMessage, setCoverMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch(`/api/opportunities/${opportunityId}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverMessage: coverMessage || undefined }),
    });
    setSubmitting(false);
    if (res.ok) {
      setCoverMessage("");
      router.refresh();
    } else {
      toast.error("Sign in to apply.");
    }
  }

  if (disabled) return null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Textarea
        placeholder="Optional note to the poster..."
        value={coverMessage}
        onChange={(e) => setCoverMessage(e.target.value)}
      />
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Applying..." : "Apply"}
      </Button>
    </form>
  );
}

export function ApplicationRow({ application, isPoster }: { application: Application; isPoster: boolean }) {
  const router = useRouter();

  async function setStatus(status: string) {
    const res = await fetch(`/api/applications/${application.id}`, {
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
        <span className="text-sm font-medium text-ink">{application.applicant.name}</span>
        <Badge variant="outline">{application.status}</Badge>
      </div>
      {application.coverMessage ? <p className="text-sm text-ink-muted">{application.coverMessage}</p> : null}
      {isPoster ? (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setStatus("SHORTLISTED")}>
            Shortlist
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setStatus("ACCEPTED")}>
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStatus("REJECTED")}>
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function OpportunityStatusControl({ opportunityId, currentStatus }: { opportunityId: string; currentStatus: string }) {
  const router = useRouter();

  async function setStatus(status: string) {
    const res = await fetch(`/api/opportunities/${opportunityId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) router.refresh();
    else toast.error("Could not update status.");
  }

  return (
    <div className="flex gap-2">
      {["OPEN", "CLOSED"].map((s) => (
        <Button key={s} size="sm" variant={s === currentStatus ? "primary" : "secondary"} onClick={() => setStatus(s)}>
          {s}
        </Button>
      ))}
    </div>
  );
}
