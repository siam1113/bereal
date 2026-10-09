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

export default function NewMentoringOfferPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [format, setFormat] = useState("ONE_ON_ONE");
  const [capacity, setCapacity] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!skillId) {
      toast.error("Pick the skill you're offering to mentor on.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/mentoring-offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        skillId,
        format,
        capacity: Number(capacity) || 1,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/mentoring/${data.offer.id}`);
    } else {
      toast.error("Could not post your mentoring offer. Please sign in and try again.");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-2xl font-medium text-ink">Offer to mentor</h1>
      <p className="mt-2 text-sm text-ink-muted">
        This is separate from the one-sided &quot;learning from&quot; declaration — it&apos;s a
        discoverable, mutual offer that someone else has to request and you have to accept.
        Any professional stage can post one.
      </p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
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
        <SkillPicker label="Skill" value={skillId} onChange={(id) => setSkillId(id)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ONE_ON_ONE">One-on-one</SelectItem>
                <SelectItem value="GROUP">Group</SelectItem>
                <SelectItem value="EITHER">Either</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="capacity">Capacity (concurrent mentees)</Label>
            <Input
              id="capacity"
              type="number"
              min={1}
              max={100}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? "Posting..." : "Post mentoring offer"}
        </Button>
      </form>
    </div>
  );
}
