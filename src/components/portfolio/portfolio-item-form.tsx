"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { DraftSuggestionPanel, type AiDraft } from "@/components/ai/draft-suggestion-panel";

export interface PortfolioItemFormValues {
  title: string;
  description: string;
  tags: string;
  visibility: "PUBLIC" | "CONNECTIONS" | "PRIVATE";
}

interface PortfolioItemFormProps {
  itemId?: string;
  initial?: Partial<PortfolioItemFormValues>;
}

export function PortfolioItemForm({ itemId, initial }: PortfolioItemFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState(initial?.tags ?? "");
  const [visibility, setVisibility] = useState<PortfolioItemFormValues["visibility"]>(
    initial?.visibility ?? "PUBLIC",
  );
  const [saving, setSaving] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [drafting, setDrafting] = useState(false);

  async function handleDraftWithAi() {
    if (!title.trim()) {
      toast.error("Add a title first — the draft is based on it.");
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch("/api/ai/portfolio-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          rawNotes: description,
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        title,
        description,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        visibility,
      };
      const res = await fetch(itemId ? `/api/portfolio/${itemId}` : "/api/portfolio", {
        method: itemId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Couldn't save — check the form and try again.");
        return;
      }
      toast.success("Portfolio item saved.");
      router.push("/settings/portfolio");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">Description</Label>
          <Button type="button" size="sm" variant="secondary" disabled={drafting} onClick={handleDraftWithAi}>
            {drafting ? "Drafting…" : "Draft with AI"}
          </Button>
        </div>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {aiDraft ? (
          <DraftSuggestionPanel
            draft={aiDraft}
            onUse={(text) => {
              setDescription(text);
              setAiDraft(null);
            }}
            onDiscard={() => setAiDraft(null)}
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Visibility</Label>
        <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PUBLIC">Public</SelectItem>
            <SelectItem value="CONNECTIONS">Connections only</SelectItem>
            <SelectItem value="PRIVATE">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
