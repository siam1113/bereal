"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";

export function ClaimAppealForm({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ? JSON.stringify(body.error) : "Couldn't submit that appeal.");
        return;
      }
      toast.success("Appeal submitted for review.");
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
      <Textarea
        placeholder="Why do you think this decision should be reconsidered?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
      />
      <Button type="submit" size="sm" disabled={busy} className="self-start">
        Appeal this decision
      </Button>
    </form>
  );
}
