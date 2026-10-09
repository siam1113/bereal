"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

interface Business {
  id: string;
  slug: string;
  name: string;
}

export default function BusinessesSettingsPage() {
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((d) => setBusinesses(d.businesses));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, city }),
      });
      if (!res.ok) {
        toast.error("Couldn't create the business page.");
        return;
      }
      setName("");
      setDescription("");
      setCity("");
      toast.success("Business page created.");
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-2xl text-ink">Businesses</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create a business page</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving} className="w-fit">
              {saving ? "Creating…" : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {businesses?.map((b) => (
          <Card key={b.id}>
            <CardContent className="flex items-center justify-between p-4">
              <p className="font-medium text-ink">{b.name}</p>
              <div className="flex gap-3 text-sm">
                <Link href={`/business/${b.slug}`} className="text-accent hover:underline">
                  View
                </Link>
                <Link href={`/settings/businesses/${b.id}`} className="text-accent hover:underline">
                  Manage
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
