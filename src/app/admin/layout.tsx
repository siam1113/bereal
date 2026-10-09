import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";

const navLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/skills", label: "Skill taxonomy" },
  { href: "/admin/claims", label: "Claims" },
  { href: "/admin/claim-appeals", label: "Claim appeals" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/reference-disputes", label: "Reference disputes" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/flags", label: "Abuse flags" },
  { href: "/admin/review-cases", label: "Review queues" },
  { href: "/admin/ai-flags", label: "AI-flagged patterns" },
  { href: "/admin/badges", label: "Badges" },
  { href: "/admin/stage-rules", label: "Stage rules" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Real authorization boundary — the proxy.ts redirect is only a UX nicety.
  await requireAdmin();

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-10">
      <aside className="w-48 shrink-0">
        <p className="mb-3 font-display text-sm font-medium text-ink-muted">Admin</p>
        <nav className="flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:bg-accent-soft hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
