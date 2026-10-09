"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

interface SkillOption {
  id: string;
  name: string;
}

function SkillPicker({
  label,
  onPick,
  excludeIds,
}: {
  label: string;
  onPick: (skill: SkillOption) => void;
  excludeIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SkillOption[]>([]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/skills?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults((data.skills ?? []).filter((s: SkillOption) => !excludeIds.includes(s.id)));
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function suggestNew() {
    if (!query.trim()) return;
    const res = await fetch("/api/skills/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: query.trim() }),
    });
    const data = await res.json();
    if (data.skill) {
      onPick(data.skill);
      setQuery("");
      toast.success(`"${data.skill.name}" added — it'll appear in search once reviewed.`);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input
        placeholder="Search a skill (e.g. carpentry, tailoring, backend engineering)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <div className="rounded-md border border-border bg-surface p-2 text-sm">
          {results.length === 0 ? (
            <button type="button" className="text-accent hover:underline" onClick={suggestNew}>
              No match — suggest &quot;{query}&quot; as a new skill
            </button>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-accent-soft"
                    onClick={() => {
                      onPick(s);
                      setQuery("");
                    }}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [availability, setAvailability] = useState("OPEN_TO_WORK");
  const [primarySkill, setPrimarySkill] = useState<SkillOption | null>(null);
  const [secondarySkills, setSecondarySkills] = useState<SkillOption[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!primarySkill) {
      toast.error("Pick a primary skill to continue.");
      return;
    }
    setSaving(true);
    try {
      await fetch("/api/profiles/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, city, region, country, availability }),
      });
      await fetch("/api/profiles/me/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: primarySkill.id, isPrimary: true }),
      });
      for (const skill of secondarySkills) {
        await fetch("/api/profiles/me/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId: skill.id, isPrimary: false }),
        });
      }
      toast.success("Profile set up.");
      router.push("/settings/profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Tell us what you do</CardTitle>
          <CardDescription>
            Pick one primary skill and as many secondary skills as apply. Secondary skills
            are fully searchable too.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <SkillPicker
            label="Primary skill"
            onPick={setPrimarySkill}
            excludeIds={primarySkill ? [primarySkill.id] : []}
          />
          {primarySkill ? (
            <Badge variant="accent" className="w-fit">
              Primary: {primarySkill.name}
            </Badge>
          ) : null}

          <SkillPicker
            label="Secondary skills (optional)"
            onPick={(s) => setSecondarySkills((prev) => [...prev, s])}
            excludeIds={[
              ...(primarySkill ? [primarySkill.id] : []),
              ...secondarySkills.map((s) => s.id),
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {secondarySkills.map((s) => (
              <Badge
                key={s.id}
                variant="outline"
                className="cursor-pointer"
                onClick={() => setSecondarySkills((prev) => prev.filter((x) => x.id !== s.id))}
              >
                {s.name} ✕
              </Badge>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bio">Short bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="region">Region</Label>
              <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Availability</Label>
            <Select value={availability} onValueChange={setAvailability}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN_TO_WORK">Open to work</SelectItem>
                <SelectItem value="OPEN_TO_COLLAB">Open to collaborate</SelectItem>
                <SelectItem value="LIMITED">Limited availability</SelectItem>
                <SelectItem value="NOT_AVAILABLE">Not available</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Finish setting up profile"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
