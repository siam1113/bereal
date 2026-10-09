"use client";

import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

interface Business {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
}

interface Membership {
  userId: string;
  role: string;
  status: string;
  user: { name: string | null; personProfile: { displayName: string; slug: string } | null };
}

export default function ManageBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [business, setBusiness] = useState<Business | null>(null);
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/businesses/${id}`)
      .then((r) => r.json())
      .then((d) => setBusiness(d.business));
    fetch(`/api/businesses/${id}/memberships`)
      .then((r) => r.json())
      .then((d) => setMemberships(d.memberships));
  }

  useEffect(load, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    setSaving(true);
    try {
      await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: business.name,
          description: business.description ?? undefined,
          city: business.city ?? undefined,
        }),
      });
      toast.success("Business updated.");
    } finally {
      setSaving(false);
    }
  }

  async function confirm(memberUserId: string) {
    await fetch(`/api/businesses/${id}/memberships/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberUserId }),
    });
    toast.success("Membership confirmed.");
    load();
  }

  if (!business) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-ink-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-2xl text-ink">Manage {business.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={business.name}
                onChange={(e) => setBusiness({ ...business, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={business.description ?? ""}
                onChange={(e) => setBusiness({ ...business, description: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={business.city ?? ""}
                onChange={(e) => setBusiness({ ...business, city: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={saving} className="w-fit">
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team & membership claims</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {memberships?.length === 0 ? (
            <p className="text-sm text-ink-muted">No membership claims yet.</p>
          ) : (
            memberships?.map((m) => (
              <div key={m.userId} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="font-medium text-ink">
                    {m.user.personProfile?.displayName ?? m.user.name}
                  </p>
                  <Badge variant={m.status === "CONFIRMED" ? "success" : "warning"}>{m.status}</Badge>
                </div>
                {m.status === "PENDING" ? (
                  <Button size="sm" onClick={() => confirm(m.userId)}>
                    Confirm
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
