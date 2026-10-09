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

export default function NewLearningCirclePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState("8");
  const [geoScope, setGeoScope] = useState("LOCAL");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/learning-circles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        skillId: skillId ?? undefined,
        capacity: Number(capacity) || 8,
        geoScope,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/learning-circles/${data.circle.id}`);
    } else {
      toast.error("Could not start that circle. Please sign in and try again.");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-2xl font-medium text-ink">Start a learning circle</h1>
      <p className="mt-2 text-sm text-ink-muted">
        You&apos;re added as the circle&apos;s first organizer automatically.
      </p>
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
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min={2}
              max={100}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
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
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? "Creating..." : "Start circle"}
        </Button>
      </form>
    </div>
  );
}
