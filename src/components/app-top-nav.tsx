import Link from "next/link";
import {
  Bell,
  BookOpen,
  Briefcase,
  Compass,
  GraduationCap,
  Home,
  LifeBuoy,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { TopNavUserMenu } from "@/components/topnav-user-menu";

const navLinks = [
  { href: "/feed", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/relationships", label: "Relationships", icon: Users },
  { href: "/opportunities", label: "Opportunities", icon: Briefcase },
  { href: "/help-requests", label: "Help requests", icon: LifeBuoy },
  { href: "/mentoring", label: "Mentoring", icon: GraduationCap },
  { href: "/learning-circles", label: "Learning circles", icon: BookOpen },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/messages", label: "Messages", icon: Mail },
];

interface AppTopNavProps {
  /** When true, hide the inline link row (used when Bottom nav already covers it). */
  minimal?: boolean;
}

export async function AppTopNav({ minimal = false }: AppTopNavProps) {
  const session = await auth();
  const user = session?.user;

  let profileSlug: string | null = null;
  if (user) {
    const profile = await prisma.personProfile.findUnique({
      where: { userId: user.id },
      select: { slug: true },
    });
    profileSlug = profile?.slug ?? null;
  }

  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/95 backdrop-blur">
      <div className="flex items-center gap-4 px-4 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-extrabold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-brand text-sm text-white">
            P
          </span>
          <span className="hidden sm:inline">Proverse</span>
        </Link>

        {minimal ? (
          <div className="min-w-0 flex-1" />
        ) : (
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-soft hover:text-ink"
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="hidden lg:inline">{link.label}</span>
                </Link>
              );
            })}
            {isAdmin ? (
              <Link
                href="/admin"
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-soft hover:text-ink"
              >
                <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="hidden lg:inline">Admin</span>
              </Link>
            ) : null}
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <Button size="sm" className="hidden rounded-full sm:flex" asChild>
                <Link href="/feed">Post</Link>
              </Button>
              <TopNavUserMenu
                name={user.name}
                email={user.email}
                image={user.image}
                isAdmin={isAdmin}
                profileSlug={profileSlug}
              />
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" className="rounded-full" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" className="rounded-full" asChild>
                <Link href="/signup">Join Proverse</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
