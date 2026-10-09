"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { DraftSuggestionPanel, type AiDraft } from "@/components/ai/draft-suggestion-panel";

interface PersonSkill {
  id: string;
  isPrimary: boolean;
  stage: string;
  skill: { id: string; name: string };
}

interface Profile {
  slug: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  availability: string;
  personSkills: PersonSkill[];
}

export default function SettingsProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [drafting, setDrafting] = useState(false);

  async function handleDraftBioWithAi() {
    if (!profile) return;
    setDrafting(true);
    try {
      const primary = profile.personSkills.find((ps) => ps.isPrimary)?.skill.name ?? null;
      const secondary = profile.personSkills.filter((ps) => !ps.isPrimary).map((ps) => ps.skill.name);
      const res = await fetch("/api/ai/bio-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profile.displayName,
          primarySkillName: primary,
          secondarySkillNames: secondary,
          existingBio: profile.bio,
        }),
      });
      if (!res.ok) {
        toast.error("Couldn't generate a draft right now.");
        return;
      }
      const data = await res.json();
      setAiDraft(data.draft);
    } finally {
      setDrafting(false);
    }
  }

  useEffect(() => {
    fetch("/api/profiles/me")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile));
  }, []);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    try {
      await fetch("/api/profiles/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: profile.bio,
          city: profile.city,
          region: profile.region,
          country: profile.country,
          availability: profile.availability,
        }),
      });
      toast.success("Profile updated.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSkill(skillId: string) {
    await fetch(`/api/profiles/me/skills/${skillId}`, { method: "DELETE" });
    setProfile((p) => (p ? { ...p, personSkills: p.personSkills.filter((ps) => ps.skill.id !== skillId) } : p));
  }

  if (!profile) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-ink-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Edit profile</h1>
        <Link href={`/p/${profile.slug}`} className="text-sm text-accent hover:underline">
          View public profile
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bio">Bio</Label>
              <Button type="button" size="sm" variant="secondary" disabled={drafting} onClick={handleDraftBioWithAi}>
                {drafting ? "Drafting…" : "Draft with AI"}
              </Button>
            </div>
            <Textarea
              id="bio"
              value={profile.bio ?? ""}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            />
            {aiDraft ? (
              <DraftSuggestionPanel
                draft={aiDraft}
                onUse={(text) => {
                  setProfile({ ...profile, bio: text });
                  setAiDraft(null);
                }}
                onDiscard={() => setAiDraft(null)}
              />
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={profile.city ?? ""}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={profile.region ?? ""}
                onChange={(e) => setProfile({ ...profile, region: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={profile.country ?? ""}
                onChange={(e) => setProfile({ ...profile, country: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Availability</Label>
            <Select
              value={profile.availability}
              onValueChange={(v) => setProfile({ ...profile, availability: v })}
            >
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
          <Button onClick={handleSave} disabled={saving} className="w-fit">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {profile.personSkills.map((ps) => (
            <Badge
              key={ps.id}
              variant={ps.isPrimary ? "accent" : "neutral"}
              className="cursor-pointer"
              onClick={() => removeSkill(ps.skill.id)}
              title="Click to remove"
            >
              {ps.skill.name} {ps.isPrimary ? "(primary)" : ""} ✕
            </Badge>
          ))}
          <Link href="/onboarding" className="text-sm text-accent hover:underline">
            + Add more skills
          </Link>
        </CardContent>
      </Card>

      <div className="flex gap-4 text-sm text-ink-muted">
        <Link href="/settings/portfolio" className="hover:text-ink">
          Manage portfolio →
        </Link>
        <Link href="/settings/experience" className="hover:text-ink">
          Manage experience →
        </Link>
        <Link href="/settings/businesses" className="hover:text-ink">
          Manage businesses →
        </Link>
      </div>
    </div>
  );
}
