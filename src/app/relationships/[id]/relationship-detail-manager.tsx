"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

export interface RelationshipDetailData {
  id: string;
  type: string;
  state: string;
  confirmationStatus: "SELF_DECLARED" | "MUTUALLY_CONFIRMED" | "EVIDENCE_REVIEWED";
  declaredByUserId: string;
  counterpartConsent: "NOT_REQUIRED" | "PENDING" | "GRANTED" | "DENIED";
  partyA: { id: string; name: string | null };
  partyB: { id: string; name: string | null };
  evidence: { id: string; description: string; url: string | null; createdAt: string }[];
  disputes: { id: string; reason: string; status: string; createdAt: string }[];
  myVisibility: { visibility: "PUBLIC" | "CONNECTIONS" | "PRIVATE"; hidden: boolean } | null;
}

export function RelationshipDetailManager({
  relationship,
  currentUserId,
}: {
  relationship: RelationshipDetailData;
  currentUserId: string;
}) {
  const router = useRouter();
  const rel = relationship;
  const counterpart = rel.partyA.id === currentUserId ? rel.partyB : rel.partyA;
  const isDeclarer = rel.declaredByUserId === currentUserId;
  const canConfirm = !isDeclarer && rel.confirmationStatus === "SELF_DECLARED";

  const [busy, setBusy] = useState(false);
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [visibility, setVisibility] = useState(rel.myVisibility?.visibility ?? "PUBLIC");
  const [hidden, setHidden] = useState(rel.myVisibility?.hidden ?? false);

  // Endorsement / feedback forms target the counterpart.
  const [skillQuery, setSkillQuery] = useState("");
  const [skillOptions, setSkillOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [endorseComment, setEndorseComment] = useState("");

  const [feedbackComment, setFeedbackComment] = useState("");
  const [communication, setCommunication] = useState(4);
  const [reliability, setReliability] = useState(4);
  const [timeManagement, setTimeManagement] = useState(4);

  // Reference: a stronger evidence tier than endorsement/feedback — only offered once
  // the relationship is itself confirmed (never on a self-declared one).
  const canWriteReference = rel.confirmationStatus === "MUTUALLY_CONFIRMED" || rel.confirmationStatus === "EVIDENCE_REVIEWED";
  const [referenceComment, setReferenceComment] = useState("");
  const [refCommunication, setRefCommunication] = useState(4);
  const [refReliability, setRefReliability] = useState(4);
  const [refTimeManagement, setRefTimeManagement] = useState(4);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    await withBusy(async () => {
      const res = await fetch(`/api/relationships/${rel.id}/confirm`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Couldn't confirm this relationship.");
        return;
      }
      toast.success("Relationship confirmed.");
      router.refresh();
    });
  }

  async function addEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withBusy(async () => {
      const res = await fetch(`/api/relationships/${rel.id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: evidenceText, url: evidenceUrl || undefined }),
      });
      if (!res.ok) {
        toast.error("Couldn't add evidence.");
        return;
      }
      toast.success("Evidence added.");
      setEvidenceText("");
      setEvidenceUrl("");
      router.refresh();
    });
  }

  async function dispute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withBusy(async () => {
      const res = await fetch(`/api/relationships/${rel.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: disputeReason }),
      });
      if (!res.ok) {
        toast.error("Couldn't file a dispute.");
        return;
      }
      toast.success("Dispute filed. An admin will review it.");
      setDisputeReason("");
      router.refresh();
    });
  }

  async function saveVisibility() {
    await withBusy(async () => {
      const res = await fetch(`/api/relationships/${rel.id}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility, hidden }),
      });
      if (!res.ok) {
        toast.error("Couldn't update your visibility setting.");
        return;
      }
      toast.success("Visibility updated.");
      router.refresh();
    });
  }

  async function searchSkills(q: string) {
    setSkillQuery(q);
    if (q.length < 2) {
      setSkillOptions([]);
      return;
    }
    const res = await fetch(`/api/skills/search?q=${encodeURIComponent(q)}&limit=8`);
    if (!res.ok) return;
    const body = await res.json();
    setSkillOptions(body.skills ?? []);
  }

  async function submitEndorsement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSkillId) {
      toast.error("Pick a skill first.");
      return;
    }
    await withBusy(async () => {
      const res = await fetch("/api/endorsements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectUserId: counterpart.id,
          skillId: selectedSkillId,
          relationshipId: rel.id,
          comment: endorseComment || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? "Couldn't submit that endorsement.");
        return;
      }
      toast.success(
        body?.endorsement?.status === "VERIFIED"
          ? "Endorsement submitted and marked verified."
          : "Endorsement submitted as unverified (relationship isn't mutually confirmed yet).",
      );
      setEndorseComment("");
      setSelectedSkillId("");
      setSkillQuery("");
      router.refresh();
    });
  }

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withBusy(async () => {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectUserId: counterpart.id,
          relationshipId: rel.id,
          attributes: { communication, reliability, timeManagement },
          comment: feedbackComment || undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Couldn't submit feedback.");
        return;
      }
      toast.success("Feedback submitted.");
      setFeedbackComment("");
      router.refresh();
    });
  }

  async function submitReference(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withBusy(async () => {
      const res = await fetch("/api/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectUserId: counterpart.id,
          relationshipId: rel.id,
          attributes: {
            communication: refCommunication,
            reliability: refReliability,
            timeManagement: refTimeManagement,
          },
          comment: referenceComment || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? "Couldn't submit that reference.");
        return;
      }
      toast.success("Reference submitted.");
      setReferenceComment("");
      router.refresh();
    });
  }

  async function respondFamilyConsent(grant: boolean) {
    await withBusy(async () => {
      const res = await fetch(`/api/relationships/${rel.id}/family-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant }),
      });
      if (!res.ok) {
        toast.error("Couldn't update consent.");
        return;
      }
      toast.success(grant ? "Consent granted." : "Consent denied.");
      router.refresh();
    });
  }

  const openDisputes = rel.disputes.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW");

  return (
    <div className="mt-6 flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-display text-xl text-ink">{counterpart.name ?? "Unknown"}</p>
            <p className="text-sm text-ink-muted">{rel.type.replace(/_/g, " ")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={rel.confirmationStatus === "MUTUALLY_CONFIRMED" ? "success" : "warning"}>
              {rel.confirmationStatus.replace(/_/g, " ")}
            </Badge>
            {openDisputes.length > 0 ? <Badge variant="danger">Disputed</Badge> : null}
          </div>
        </CardContent>
      </Card>

      {canConfirm ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-ink">
              {counterpart.name ?? "This person"} declared this relationship. Confirm it only if
              it actually happened the way described — this cannot be undone unilaterally.
            </p>
            <Button className="mt-3" disabled={busy} onClick={confirm}>
              Confirm this happened
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {rel.type === "FAMILY" && !isDeclarer && rel.counterpartConsent === "PENDING" ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-ink">
              {counterpart.name ?? "This person"} wants to show your identity attached to this
              family relationship publicly. Grant consent only if you agree.
            </p>
            <div className="mt-3 flex gap-2">
              <Button disabled={busy} onClick={() => respondFamilyConsent(true)}>
                Grant
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => respondFamilyConsent(false)}>
                Deny
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Your visibility</h2>
          <p className="mt-1 text-sm text-ink-muted">
            This only changes what shows on your own profile — it has no effect on{" "}
            {counterpart.name ?? "the other party"}&apos;s visibility setting.
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
            <label className="flex items-center gap-2 text-sm text-ink">
              <Switch checked={hidden} onCheckedChange={setHidden} /> Hide entirely
            </label>
            <Button size="sm" disabled={busy} onClick={saveVisibility}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Evidence</h2>
          <div className="mt-3 flex flex-col gap-2">
            {rel.evidence.length === 0 ? (
              <p className="text-sm text-ink-muted">No evidence added yet.</p>
            ) : (
              rel.evidence.map((e) => (
                <div key={e.id} className="rounded-md border border-border p-3 text-sm text-ink">
                  <p>{e.description}</p>
                  {e.url ? (
                    <a href={e.url} className="text-accent underline" target="_blank" rel="noreferrer">
                      {e.url}
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <form onSubmit={addEvidence} className="mt-4 flex flex-col gap-2">
            <Textarea
              placeholder="Describe the project or activity..."
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
              required
            />
            <Input
              placeholder="Link (optional)"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={busy} className="self-start">
              Add evidence
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Endorse a skill</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Endorsing {counterpart.name ?? "them"} based on this relationship. Shows as verified
            only once this relationship is mutually confirmed.
          </p>
          <form onSubmit={submitEndorsement} className="mt-3 flex flex-col gap-2">
            <Input
              placeholder="Search skills..."
              value={skillQuery}
              onChange={(e) => searchSkills(e.target.value)}
            />
            {skillOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skillOptions.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => {
                      setSelectedSkillId(s.id);
                      setSkillQuery(s.name);
                      setSkillOptions([]);
                    }}
                    className="rounded-full border border-border-strong px-3 py-1 text-xs text-ink hover:bg-accent-soft"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            ) : null}
            <Textarea
              placeholder="Comment (optional)"
              value={endorseComment}
              onChange={(e) => setEndorseComment(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={busy} className="self-start">
              Submit endorsement
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Leave professional feedback</h2>
          <form onSubmit={submitFeedback} className="mt-3 flex flex-col gap-3">
            {[
              { label: "Communication", value: communication, set: setCommunication },
              { label: "Reliability", value: reliability, set: setReliability },
              { label: "Time management", value: timeManagement, set: setTimeManagement },
            ].map((attr) => (
              <div key={attr.label}>
                <Label>
                  {attr.label}: {attr.value}/5
                </Label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={attr.value}
                  onChange={(e) => attr.set(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </div>
            ))}
            <Textarea
              placeholder="Comment (optional)"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={busy} className="self-start">
              Submit feedback
            </Button>
          </form>
        </CardContent>
      </Card>

      {canWriteReference ? (
        <Card>
          <CardContent className="p-5">
            <h2 className="font-display text-lg font-medium text-ink">Write a reference</h2>
            <p className="mt-1 text-sm text-ink-muted">
              A stronger, structured evidence tier above endorsements/feedback — only available
              because this relationship is mutually confirmed. {counterpart.name ?? "They"} controls
              whether this shows on their own profile, and can dispute it.
            </p>
            <form onSubmit={submitReference} className="mt-3 flex flex-col gap-3">
              {[
                { label: "Communication", value: refCommunication, set: setRefCommunication },
                { label: "Reliability", value: refReliability, set: setRefReliability },
                { label: "Time management", value: refTimeManagement, set: setRefTimeManagement },
              ].map((attr) => (
                <div key={attr.label}>
                  <Label>
                    {attr.label}: {attr.value}/5
                  </Label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={attr.value}
                    onChange={(e) => attr.set(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </div>
              ))}
              <Textarea
                placeholder="Comment (optional)"
                value={referenceComment}
                onChange={(e) => setReferenceComment(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={busy} className="self-start">
                Submit reference
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-medium text-ink">Disputes</h2>
          <div className="mt-3 flex flex-col gap-2">
            {rel.disputes.length === 0 ? (
              <p className="text-sm text-ink-muted">No disputes.</p>
            ) : (
              rel.disputes.map((d) => (
                <div key={d.id} className="rounded-md border border-border p-3 text-sm">
                  <Badge variant={d.status.startsWith("RESOLVED") ? "neutral" : "danger"}>{d.status}</Badge>
                  <p className="mt-1 text-ink">{d.reason}</p>
                </div>
              ))
            )}
          </div>
          <form onSubmit={dispute} className="mt-4 flex flex-col gap-2">
            <Textarea
              placeholder="Why are you disputing this relationship?"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              required
            />
            <Button type="submit" size="sm" variant="danger" disabled={busy} className="self-start">
              File a dispute
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
