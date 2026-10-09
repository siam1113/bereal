import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";

const navLinks = [
  { href: "/discover", label: "Discover" },
  { href: "/feed", label: "Feed" },
  { href: "/relationships", label: "Relationships" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/help-requests", label: "Help requests" },
  { href: "/mentoring", label: "Mentoring" },
  { href: "/learning-circles", label: "Learning circles" },
];

export async function SiteHeader() {
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

  return (
    <header className="border-b border-border bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display text-xl font-semibold text-ink">
          COMMON
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-ink-muted md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <UserMenu
              name={user.name}
              email={user.email}
              image={user.image}
              isAdmin={user.role === "ADMIN" || user.role === "MODERATOR"}
              profileSlug={profileSlug}
            />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Join COMMON</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
