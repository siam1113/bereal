"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

interface Experience {
  id: string;
  title: string;
  organizationName: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export default function ExperienceSettingsPage() {
  const [items, setItems] = useState<Experience[] | null>(null);
  const [title, setTitle] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/experience")
      .then((r) => r.json())
      .then((d) => setItems(d.items));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/experience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          organizationName,
          startDate,
          endDate: endDate || null,
          description,
        }),
      });
      if (!res.ok) {
        toast.error("Couldn't save — check the dates and try again.");
        return;
      }
      setTitle("");
      setOrganizationName("");
      setStartDate("");
      setEndDate("");
      setDescription("");
      toast.success("Experience added.");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/experience/${id}`, { method: "DELETE" });
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-2xl text-ink">Experience</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add an entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="org">Organization</Label>
                <Input
                  id="org"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start">Start date</Label>
                <Input
                  id="start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end">End date (blank if current)</Label>
                <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving} className="w-fit">
              {saving ? "Saving…" : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {items?.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-ink">
                  {item.title} · {item.organizationName}
                </p>
                <p className="text-sm text-ink-muted">
                  {new Date(item.startDate).getFullYear()}
                  {item.endDate ? ` – ${new Date(item.endDate).getFullYear()}` : " – present"}
                </p>
              </div>
              <button className="text-sm text-danger hover:underline" onClick={() => remove(item.id)}>
                Delete
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
