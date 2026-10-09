"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function ApiKeysSettingsPage() {
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [mintedToken, setMintedToken] = useState<string | null>(null);

  function load() {
    fetch("/api/api-keys")
      .then((r) => r.json())
      .then((d) => {
        setKeys(d.keys ?? []);
        setAvailableScopes(d.availableScopes ?? []);
      });
  }

  useEffect(load, []);

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleCreate() {
    if (!name.trim() || selectedScopes.length === 0) {
      toast.error("Name and at least one scope are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes: selectedScopes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't create key.");
        return;
      }
      setMintedToken(data.token);
      setName("");
      setSelectedScopes([]);
      load();
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    toast.success("Key revoked.");
    load();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="font-display text-2xl text-ink">API keys</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Scoped tokens for non-browser clients (scripts, integrations, a future native
          app) — each key is tied to your account and can only do what its chosen scopes
          allow. It never grants more than your own browser session already can. See{" "}
          <code className="text-xs">docs/platform-api.md</code> for the full reference.
        </p>
      </div>

      {mintedToken && (
        <Card className="border-accent">
          <CardContent className="p-4">
            <p className="font-medium text-ink">Your new key — copy it now</p>
            <p className="mt-1 text-sm text-ink-muted">
              This is shown once. It cannot be recovered after you leave this page.
            </p>
            <code className="mt-3 block overflow-x-auto rounded bg-surface-muted p-3 text-xs">
              {mintedToken}
            </code>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setMintedToken(null)}>
              Done, I&apos;ve copied it
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create a new key</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              placeholder="e.g. my-mobile-prototype"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Scopes</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {availableScopes.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm text-ink">
                  <Checkbox
                    checked={selectedScopes.includes(scope)}
                    onCheckedChange={() => toggleScope(scope)}
                  />
                  {scope}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="w-fit">
            {creating ? "Creating..." : "Create key"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!keys && <p className="text-sm text-ink-muted">Loading...</p>}
          {keys?.length === 0 && <p className="text-sm text-ink-muted">No API keys yet.</p>}
          {keys?.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between gap-4 rounded border border-border p-3"
            >
              <div>
                <p className="font-medium text-ink">
                  {key.name} <span className="font-mono text-xs text-ink-muted">{key.keyPrefix}...</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {key.scopes.map((s) => (
                    <Badge key={s} variant="neutral">
                      {s}
                    </Badge>
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {key.revokedAt
                    ? "Revoked"
                    : key.expiresAt
                      ? `Expires ${new Date(key.expiresAt).toLocaleDateString()}`
                      : "No expiry"}
                  {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              {!key.revokedAt && (
                <Button size="sm" variant="danger" onClick={() => handleRevoke(key.id)}>
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
