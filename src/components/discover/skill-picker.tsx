"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SkillOption {
  id: string;
  name: string;
}

interface SkillPickerProps {
  label?: string;
  value: string | null;
  onChange: (skillId: string | null, skillName: string | null) => void;
  className?: string;
}

export function SkillPicker({ label = "Skill", value, onChange, className }: SkillPickerProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SkillOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!query) {
        setOptions([]);
        return;
      }
      const res = await fetch(`/api/search/skills?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setOptions(data.skills ?? []);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className={cn("relative", className)}>
      {label ? <label className="mb-1 block text-sm font-medium text-ink">{label}</label> : null}
      <Input
        value={query}
        placeholder="Search skills..."
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange(null, null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && options.length > 0 ? (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-md">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent-soft"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(opt.name);
                  setOpen(false);
                  onChange(opt.id, opt.name);
                }}
              >
                {opt.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
