"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";

export type ReportTargetType =
  | "USER"
  | "POST"
  | "COMMENT"
  | "MESSAGE"
  | "RELATIONSHIP"
  | "BUSINESS"
  | "PORTFOLIO_ITEM";

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
}

/**
 * Drop this onto any entity page to let a signed-in user report it. Self-contained —
 * owns its own dialog state and POSTs to /api/reports directly.
 */
export function ReportButton({ targetType, targetId, targetUserId }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      toast.error("Please describe the issue");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, targetUserId, reason, details: details || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Could not submit report");
      }
      toast.success("Report submitted. Thanks for flagging this.");
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-ink-muted">
          <Flag className="h-3.5 w-3.5" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {targetType.toLowerCase().replace("_", " ")}</DialogTitle>
          <DialogDescription>
            Our moderation team reviews reports. This does not notify the other party directly.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-reason">Reason</Label>
            <Input
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Harassment, spam, impersonation"
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-details">Additional details (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={2000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
