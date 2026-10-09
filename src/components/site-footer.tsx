import Link from "next/link";

const links = [
  { href: "/discover", label: "Discover" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/help-requests", label: "Help requests" },
  { href: "/settings/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-display text-ink">COMMON</span> — Every skill deserves to be
          seen.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
