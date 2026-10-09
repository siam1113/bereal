"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SkillPicker } from "@/components/discover/skill-picker";
import { toast } from "@/components/ui/toaster";

interface ServiceOfferingFormProps {
  mode: "create" | "edit";
  offeringId?: string;
  personProfileId?: string;
  initial?: {
    title: string;
    description: string;
    priceNote: string | null;
    skillId: string | null;
    isActive: boolean;
  };
}

export function ServiceOfferingForm({ mode, offeringId, personProfileId, initial }: ServiceOfferingFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceNote, setPriceNote] = useState(initial?.priceNote ?? "");
  const [skillId, setSkillId] = useState<string | null>(initial?.skillId ?? null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const body =
      mode === "create"
        ? { personProfileId, title, description, priceNote: priceNote || undefined, skillId: skillId ?? undefined }
        : { title, description, priceNote: priceNote || null, skillId: skillId ?? null };
    const res = await fetch(mode === "create" ? "/api/services" : `/api/services/${offeringId}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/settings/services");
      router.refresh();
    } else {
      toast.error("Could not save this service.");
    }
  }

  async function onDelete() {
    if (!offeringId) return;
    const res = await fetch(`/api/services/${offeringId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/settings/services");
      router.refresh();
    } else {
      toast.error("Could not delete this service.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <SkillPicker label="Related skill (optional)" value={skillId} onChange={(id) => setSkillId(id)} />
      <div>
        <Label htmlFor="priceNote">Price note (optional)</Label>
        <Input id="priceNote" value={priceNote} onChange={(e) => setPriceNote(e.target.value)} placeholder="e.g. Quoted per project" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : mode === "create" ? "Create service" : "Save changes"}
        </Button>
        {mode === "edit" ? (
          <Button type="button" variant="danger" onClick={onDelete}>
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}
