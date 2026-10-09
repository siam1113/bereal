"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkillPicker } from "@/components/discover/skill-picker";
import { toast } from "@/components/ui/toaster";

type Kind = "STANDARD" | "MICROTASK" | "APPRENTICESHIP" | "TEAM_PROJECT";

interface TeamSlotDraft {
  roleTitle: string;
  skillId: string | null;
  headcountNeeded: number;
}

export default function NewOpportunityPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("TASK");
  const [kind, setKind] = useState<Kind>("STANDARD");
  const [locationType, setLocationType] = useState("REMOTE");
  const [geoScope, setGeoScope] = useState("LOCAL");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // MICROTASK
  const [estimatedHours, setEstimatedHours] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceNote, setRecurrenceNote] = useState("");

  // APPRENTICESHIP
  const [durationWeeks, setDurationWeeks] = useState("");
  const [mentorshipFocus, setMentorshipFocus] = useState("");

  // TEAM_PROJECT
  const [teamSlots, setTeamSlots] = useState<TeamSlotDraft[]>([{ roleTitle: "", skillId: null, headcountNeeded: 1 }]);

  function updateSlot(index: number, patch: Partial<TeamSlotDraft>) {
    setTeamSlots((slots) => slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const body: Record<string, unknown> = {
      title,
      description,
      type,
      kind,
      locationType,
      geoScope,
      skillId: skillId ?? undefined,
    };
    if (kind === "MICROTASK") {
      body.estimatedHours = estimatedHours ? Number(estimatedHours) : undefined;
      body.isRecurring = isRecurring;
      body.recurrenceNote = recurrenceNote || undefined;
    }
    if (kind === "APPRENTICESHIP") {
      body.durationWeeks = durationWeeks ? Number(durationWeeks) : undefined;
      body.mentorshipFocus = mentorshipFocus || undefined;
    }
    if (kind === "TEAM_PROJECT") {
      body.teamSlots = teamSlots
        .filter((slot) => slot.roleTitle.trim().length > 0)
        .map((slot) => ({
          roleTitle: slot.roleTitle,
          skillId: slot.skillId ?? undefined,
          headcountNeeded: slot.headcountNeeded,
        }));
    }

    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/opportunities/${data.opportunity.id}`);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Could not post this opportunity. Please sign in and try again.");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-2xl font-medium text-ink">Post an opportunity</h1>
      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
        <div>
          <Label>Kind</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STANDARD">Standard (task / contract / full-time)</SelectItem>
              <SelectItem value="MICROTASK">Microtask / gig</SelectItem>
              <SelectItem value="APPRENTICESHIP">Apprenticeship</SelectItem>
              <SelectItem value="TEAM_PROJECT">Team project (multiple roles)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <SkillPicker label="Related skill (optional)" value={skillId} onChange={(id) => setSkillId(id)} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TASK">Task</SelectItem>
                <SelectItem value="CONTRACT">Contract</SelectItem>
                <SelectItem value="FULL_TIME">Full-time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Location</Label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ONSITE">On-site</SelectItem>
                <SelectItem value="REMOTE">Remote</SelectItem>
                <SelectItem value="HYBRID">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Scope</Label>
          <Select value={geoScope} onValueChange={setGeoScope}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOCAL">Local</SelectItem>
              <SelectItem value="REGION">Region / country</SelectItem>
              <SelectItem value="GLOBAL">Global</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {kind === "MICROTASK" ? (
          <div className="flex flex-col gap-4 rounded-md border border-border p-4">
            <h2 className="text-sm font-medium text-ink-muted">Microtask details</h2>
            <div>
              <Label htmlFor="estimatedHours">Estimated hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                min={1}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isRecurring"
                checked={isRecurring}
                onCheckedChange={(checked) => setIsRecurring(checked === true)}
              />
              <Label htmlFor="isRecurring">This task recurs</Label>
            </div>
            {isRecurring ? (
              <div>
                <Label htmlFor="recurrenceNote">Recurrence (free text, e.g. &quot;weekly&quot;)</Label>
                <Input
                  id="recurrenceNote"
                  value={recurrenceNote}
                  onChange={(e) => setRecurrenceNote(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {kind === "APPRENTICESHIP" ? (
          <div className="flex flex-col gap-4 rounded-md border border-border p-4">
            <h2 className="text-sm font-medium text-ink-muted">Apprenticeship details</h2>
            <div>
              <Label htmlFor="durationWeeks">Duration (weeks)</Label>
              <Input
                id="durationWeeks"
                type="number"
                min={1}
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mentorshipFocus">What will the apprentice learn?</Label>
              <Textarea
                id="mentorshipFocus"
                value={mentorshipFocus}
                onChange={(e) => setMentorshipFocus(e.target.value)}
                placeholder="Focus area, what mentorship looks like day to day..."
              />
              <p className="mt-1 text-xs text-ink-muted">
                This is a plain description for now — it isn&apos;t yet linked to a structured mentor relationship
                or team-history record.
              </p>
            </div>
          </div>
        ) : null}

        {kind === "TEAM_PROJECT" ? (
          <div className="flex flex-col gap-4 rounded-md border border-border p-4">
            <h2 className="text-sm font-medium text-ink-muted">Roles needed</h2>
            {teamSlots.map((slot, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-border-subtle p-3">
                <div>
                  <Label htmlFor={`role-${i}`}>Role title</Label>
                  <Input
                    id={`role-${i}`}
                    value={slot.roleTitle}
                    onChange={(e) => updateSlot(i, { roleTitle: e.target.value })}
                    placeholder="e.g. Electrician"
                  />
                </div>
                <SkillPicker
                  label="Required skill (optional)"
                  value={slot.skillId}
                  onChange={(id) => updateSlot(i, { skillId: id })}
                />
                <div>
                  <Label htmlFor={`headcount-${i}`}>People needed</Label>
                  <Input
                    id={`headcount-${i}`}
                    type="number"
                    min={1}
                    value={slot.headcountNeeded}
                    onChange={(e) => updateSlot(i, { headcountNeeded: Number(e.target.value) || 1 })}
                  />
                </div>
                {teamSlots.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => setTeamSlots((slots) => slots.filter((_, idx) => idx !== i))}
                  >
                    Remove role
                  </Button>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => setTeamSlots((slots) => [...slots, { roleTitle: "", skillId: null, headcountNeeded: 1 }])}
            >
              Add another role
            </Button>
          </div>
        ) : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Posting..." : "Post opportunity"}
        </Button>
      </form>
    </div>
  );
}
