"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

const CLAIM_TYPES = ["IDENTITY", "EXPERIENCE", "CREDENTIAL", "PROJECT_WORK", "COMPETENCY"] as const;

const STATUS_VARIANT = {
  SUBMITTED: "warning",
  IN_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REVOKED: "danger",
} as const;

export interface ClaimRow {
  id: string;
  claimType: string;
  title: string;
  status: keyof typeof STATUS_VARIANT;
  submittedAt: string;
}

export function ClaimManager({ claims }: { claims: ClaimRow[] }) {
  const router = useRouter();
  const [claimType, setClaimType] = useState<(typeof CLAIM_TYPES)[number]>("IDENTITY");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimType,
          title,
          description: description || undefined,
          evidenceUrls: evidenceUrl ? [evidenceUrl] : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ? JSON.stringify(body.error) : "Couldn't submit that claim.");
        return;
      }
      toast.success("Claim submitted for review.");
      setTitle("");
      setDescription("");
      setEvidenceUrl("");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <Card>
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Submit a claim</h2>
          <p className="mt-1 text-sm text-ink-muted">
            An admin reviews every claim before it&apos;s marked verified — nothing here is
            auto-approved.
          </p>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <div>
              <Label>Claim type</Label>
              <Select value={claimType} onValueChange={(v) => setClaimType(v as typeof claimType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="evidenceUrl">Evidence link (optional)</Label>
              <Input
                id="evidenceUrl"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={isSubmitting} className="self-start">
              {isSubmitting ? "Submitting..." : "Submit claim"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="font-display text-lg font-medium text-ink">My claims</h2>
        <div className="mt-3 flex flex-col gap-3">
          {claims.length === 0 ? <p className="text-sm text-ink-muted">No claims submitted yet.</p> : null}
          {claims.map((claim) => (
            <Link key={claim.id} href={`/claims/${claim.id}`}>
              <Card className="transition-colors hover:border-border-strong">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-ink">{claim.title}</p>
                    <p className="text-xs text-ink-muted">{claim.claimType.replace(/_/g, " ")}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[claim.status]}>{claim.status.replace(/_/g, " ")}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
