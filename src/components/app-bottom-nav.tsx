import Link from "next/link";
import { Bell, Compass, Home, Mail, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/feed", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/relationships", label: "Relationships", icon: Users },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/messages", label: "Messages", icon: Mail },
];

interface AppBottomNavProps {
  /** "always" renders at every breakpoint (user chose Bottom in settings).
   *  "mobile-only" renders only below md, as the fallback for Left/Right/Top layouts. */
  mode: "always" | "mobile-only";
}

export async function AppBottomNav({ mode }: AppBottomNavProps) {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-paper/95 py-2 backdrop-blur",
        mode === "mobile-only" && "md:hidden",
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-ink transition-colors hover:bg-accent-soft"
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} />
            <span className="hidden text-[10px] font-medium sm:block">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
