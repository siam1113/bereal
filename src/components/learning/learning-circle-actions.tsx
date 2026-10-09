"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function JoinCircleButton({ circleId, disabled }: { circleId: string; disabled: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  if (disabled) return null;

  async function onClick() {
    setSubmitting(true);
    const res = await fetch(`/api/learning-circles/${circleId}/join`, { method: "POST" });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Join request sent.");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error ?? "Could not request to join.");
    }
  }

  return (
    <Button size="sm" disabled={submitting} onClick={onClick}>
      Request to join
    </Button>
  );
}

export function LeaveCircleButton({ circleId, userId }: { circleId: string; userId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setSubmitting(true);
    const res = await fetch(`/api/learning-circles/${circleId}/members/${userId}/remove`, { method: "POST" });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Left the circle.");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error ?? "Could not leave this circle.");
    }
  }

  return (
    <Button size="sm" variant="ghost" disabled={submitting} onClick={onClick}>
      Leave circle
    </Button>
  );
}

interface MemberRow {
  userId: string;
  role: string;
  status: string;
  user: { id: string; name: string | null; personProfile: { slug: string } | null };
}

export function CircleMemberManager({ circleId, members }: { circleId: string; members: MemberRow[] }) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);

  async function decide(userId: string, approve: boolean) {
    setActingId(userId);
    try {
      const res = await fetch(`/api/learning-circles/${circleId}/members/${userId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      if (res.ok) {
        toast.success(approve ? "Member approved." : "Request declined.");
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Could not update that request.");
      }
    } finally {
      setActingId(null);
    }
  }

  const pending = members.filter((m) => m.status === "PENDING");
  if (pending.length === 0) return <p className="text-sm text-ink-muted">No pending join requests.</p>;

  return (
    <div className="flex flex-col gap-3">
      {pending.map((m) => (
        <div key={m.userId} className="flex items-center justify-between rounded-md border border-border p-3">
          <span className="text-sm font-medium text-ink">{m.user.name}</span>
          <div className="flex gap-2">
            <Button size="sm" disabled={actingId === m.userId} onClick={() => decide(m.userId, true)}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={actingId === m.userId}
              onClick={() => decide(m.userId, false)}
            >
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
