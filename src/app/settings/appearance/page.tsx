"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelBottom, PanelLeft, PanelRight, PanelTop } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

type NavPosition = "LEFT" | "RIGHT" | "TOP" | "BOTTOM";

const OPTIONS: { value: NavPosition; label: string; description: string; icon: typeof PanelLeft }[] = [
  {
    value: "LEFT",
    label: "Left",
    description: "Icon sidebar on the left. The default layout.",
    icon: PanelLeft,
  },
  {
    value: "RIGHT",
    label: "Right",
    description: "Icon sidebar on the right.",
    icon: PanelRight,
  },
  {
    value: "TOP",
    label: "Top",
    description: "Horizontal navigation bar across the top.",
    icon: PanelTop,
  },
  {
    value: "BOTTOM",
    label: "Bottom",
    description: "Navigation bar fixed to the bottom of the screen.",
    icon: PanelBottom,
  },
];

export default function AppearanceSettingsPage() {
  const router = useRouter();
  const [current, setCurrent] = useState<NavPosition | null>(null);
  const [saving, setSaving] = useState<NavPosition | null>(null);

  useEffect(() => {
    fetch("/api/users/me/preferences")
      .then((res) => res.json())
      .then((data) => setCurrent(data.navPosition ?? "LEFT"))
      .catch(() => setCurrent("LEFT"));
  }, []);

  async function choose(value: NavPosition) {
    if (value === current) return;
    setSaving(value);
    try {
      const res = await fetch("/api/users/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ navPosition: value }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setCurrent(value);
      toast.success("Navigation position updated");
      router.refresh();
    } catch {
      toast.error("Couldn't save your preference. Try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/settings" className="text-sm text-ink-muted hover:underline">
        &larr; Settings
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Appearance</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Choose where the main navigation appears. This applies across devices once you&apos;re
        signed in.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = current === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={current === null || saving !== null}
              onClick={() => choose(option.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors disabled:opacity-60",
                selected
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <Icon
                className={cn("h-6 w-6", selected ? "text-accent" : "text-ink-muted")}
                strokeWidth={1.75}
              />
              <span className={cn("text-sm font-semibold", selected ? "text-accent" : "text-ink")}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        {OPTIONS.find((o) => o.value === current)?.description}
      </p>
      <p className="mt-6 text-xs text-ink-muted">
        On small screens, the Left and Right layouts collapse to a bottom bar for easier
        reach. Top and Bottom stay as-is at any screen size.
      </p>
    </div>
  );
}
