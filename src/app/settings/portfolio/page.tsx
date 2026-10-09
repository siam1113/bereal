"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
}

export default function PortfolioListPage() {
  const [items, setItems] = useState<PortfolioItem[] | null>(null);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => setItems(d.items));
  }, []);

  async function remove(id: string) {
    await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
    toast.success("Portfolio item removed.");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Portfolio</h1>
        <Button asChild size="sm">
          <Link href="/settings/portfolio/new">+ Add item</Link>
        </Button>
      </div>

      {!items ? (
        <p className="text-ink-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-ink-muted">No portfolio items yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-sm text-ink-muted">{item.description}</p>
                <div className="flex gap-3 text-sm">
                  <Link href={`/settings/portfolio/${item.id}`} className="text-accent hover:underline">
                    Edit
                  </Link>
                  <button className="text-danger hover:underline" onClick={() => remove(item.id)}>
                    Delete
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
