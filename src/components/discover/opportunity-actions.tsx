"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

interface Application {
  id: string;
  coverMessage: string | null;
  status: string;
  applicant: { name: string | null };
}

interface TeamSlotOption {
  id: string;
  roleTitle: string;
  headcountNeeded: number;
  headcountFilled: number;
}

export function ApplyForm({
  opportunityId,
  disabled,
  teamSlots,
}: {
  opportunityId: string;
  disabled: boolean;
  teamSlots?: TeamSlotOption[];
}) {
  const router = useRouter();
  const [coverMessage, setCoverMessage] = useState("");
  const [teamSlotId, setTeamSlotId] = useState<string | undefined>(teamSlots?.[0]?.id);
  const [submitting, setSubmitting] = useState(false);
  const isTeamProject = !!teamSlots;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isTeamProject && !teamSlotId) {
      toast.error("Choose a role to apply for.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/opportunities/${opportunityId}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverMessage: coverMessage || undefined, teamSlotId }),
    });
    setSubmitting(false);
    if (res.ok) {
      setCoverMessage("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Sign in to apply.");
    }
  }

  if (disabled) return null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      {isTeamProject ? (
        <div>
          <Label>Role</Label>
          <Select value={teamSlotId} onValueChange={setTeamSlotId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a role" />
            </SelectTrigger>
            <SelectContent>
              {teamSlots!.map((slot) => (
                <SelectItem key={slot.id} value={slot.id}>
                  {slot.roleTitle} ({slot.headcountFilled}/{slot.headcountNeeded} filled)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
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
    else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Could not update status.");
    }
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

interface TeamSlotWithApplications {
  id: string;
  roleTitle: string;
  headcountNeeded: number;
  headcountFilled: number;
  skill: { name: string } | null;
  applications: Application[];
}

/** TEAM_PROJECT only: one role per card, with its own applicant roster. */
export function TeamRoster({
  opportunityId,
  teamSlots,
  isPoster,
}: {
  opportunityId: string;
  teamSlots: TeamSlotWithApplications[];
  isPoster: boolean;
}) {
  const router = useRouter();
  const [newRole, setNewRole] = useState("");
  const [adding, setAdding] = useState(false);

  async function addRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRole.trim()) return;
    setAdding(true);
    const res = await fetch(`/api/opportunities/${opportunityId}/team-slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleTitle: newRole }),
    });
    setAdding(false);
    if (res.ok) {
      setNewRole("");
      router.refresh();
    } else {
      toast.error("Could not add role.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {teamSlots.map((slot) => (
        <div key={slot.id} className="rounded-md border border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-ink">
              {slot.roleTitle}
              {slot.skill ? ` · ${slot.skill.name}` : ""}
            </h3>
            <Badge variant={slot.headcountFilled >= slot.headcountNeeded ? "accent" : "outline"}>
              {slot.headcountFilled}/{slot.headcountNeeded} filled
            </Badge>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {slot.applications.map((a) => (
              <ApplicationRow key={a.id} application={a} isPoster={isPoster} />
            ))}
            {slot.applications.length === 0 ? (
              <p className="text-sm text-ink-muted">No applicants for this role yet.</p>
            ) : null}
          </div>
        </div>
      ))}
      {isPoster ? (
        <form onSubmit={addRole} className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
            placeholder="Add another role (e.g. Project manager)"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={adding}>
            {adding ? "Adding..." : "Add role"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
