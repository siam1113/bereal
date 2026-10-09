"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function InquiryForm({ offeringId }: { offeringId: string }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch(`/api/services/${offeringId}/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSent(true);
      setMessage("");
    } else {
      toast.error("Sign in to send an inquiry.");
    }
  }

  if (sent) return <p className="text-sm text-success">Inquiry sent.</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Textarea
        placeholder="Describe what you need..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Sending..." : "Send inquiry"}
      </Button>
    </form>
  );
}
