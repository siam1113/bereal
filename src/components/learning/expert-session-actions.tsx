"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function BookSessionButton({
  sessionId,
  disabled,
  alreadyBooked,
}: {
  sessionId: string;
  disabled: boolean;
  alreadyBooked: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function book() {
    setSubmitting(true);
    const res = await fetch(`/api/expert-sessions/${sessionId}/bookings`, { method: "POST" });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Booked.");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error ?? "Could not book this session.");
    }
  }

  async function cancel() {
    setSubmitting(true);
    const res = await fetch(`/api/expert-sessions/${sessionId}/bookings/cancel`, { method: "POST" });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Booking cancelled.");
      router.refresh();
    } else {
      toast.error("Could not cancel your booking.");
    }
  }

  if (disabled) return null;

  return alreadyBooked ? (
    <Button size="sm" variant="secondary" disabled={submitting} onClick={cancel}>
      Cancel my booking
    </Button>
  ) : (
    <Button size="sm" disabled={submitting} onClick={book}>
      Book this session
    </Button>
  );
}

export function CancelSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setSubmitting(true);
    const res = await fetch(`/api/expert-sessions/${sessionId}/cancel`, { method: "POST" });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Session cancelled.");
      router.refresh();
    } else {
      toast.error("Could not cancel this session.");
    }
  }

  return (
    <Button size="sm" variant="ghost" disabled={submitting} onClick={onClick}>
      Cancel session
    </Button>
  );
}
