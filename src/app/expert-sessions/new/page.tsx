"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkillPicker } from "@/components/discover/skill-picker";
import { toast } from "@/components/ui/toaster";

export default function NewExpertSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [locationType, setLocationType] = useState("REMOTE");
  const [geoScope, setGeoScope] = useState("GLOBAL");
  const [locationNote, setLocationNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt || !endsAt) {
      toast.error("Set a start and end time.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/expert-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        skillId: skillId ?? undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        capacity: Number(capacity) || 1,
        locationType,
        geoScope,
        locationNote: locationNote || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/expert-sessions/${data.session.id}`);
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error ?? "Could not create that session. Please sign in and try again.");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-2xl font-medium text-ink">Host an expert session</h1>
      <p className="mt-2 text-sm text-ink-muted">No payment processing in V1 — this just reserves a spot.</p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <SkillPicker label="Related skill (optional)" value={skillId} onChange={(id) => setSkillId(id)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="startsAt">Starts</Label>
            <Input
              id="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="endsAt">Ends</Label>
            <Input
              id="endsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min={1}
              max={500}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div>
            <Label>Location type</Label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REMOTE">Remote</SelectItem>
                <SelectItem value="ONSITE">Onsite</SelectItem>
                <SelectItem value="HYBRID">Hybrid</SelectItem>
              </SelectContent>
            </Select>
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
        </div>
        <div>
          <Label htmlFor="locationNote">Location note (optional)</Label>
          <Input
            id="locationNote"
            placeholder="e.g. video link sent after booking — never an exact address"
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? "Creating..." : "Create session"}
        </Button>
      </form>
    </div>
  );
}
