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
import { SidebarUserMenu } from "@/components/sidebar-user-menu";

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

export async function AppSidebar() {
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
    <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col justify-between py-2 md:flex md:w-20 xl:w-72">
      <div className="flex flex-col gap-1 px-2">
        <Link
          href="/"
          className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-extrabold text-ink transition-colors hover:bg-accent-soft xl:w-full xl:justify-start xl:px-3"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-brand text-sm text-white xl:mr-2">
            P
          </span>
          <span className="hidden xl:inline">Proverse</span>
        </Link>

        <nav className="mt-2 flex flex-col gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex h-12 w-12 items-center justify-center gap-4 rounded-full text-ink transition-colors hover:bg-accent-soft xl:w-full xl:justify-start xl:px-3"
              >
                <Icon className="h-6 w-6 shrink-0" strokeWidth={1.75} />
                <span className="hidden text-lg xl:inline">{link.label}</span>
              </Link>
            );
          })}
          {isAdmin ? (
            <Link
              href="/admin"
              className="flex h-12 w-12 items-center justify-center gap-4 rounded-full text-ink transition-colors hover:bg-accent-soft xl:w-full xl:justify-start xl:px-3"
            >
              <ShieldCheck className="h-6 w-6 shrink-0" strokeWidth={1.75} />
              <span className="hidden text-lg xl:inline">Admin</span>
            </Link>
          ) : null}
        </nav>

        {user ? (
          <Button
            size="lg"
            asChild
            className="mt-3 hidden w-full rounded-full xl:flex"
          >
            <Link href="/feed">Post</Link>
          </Button>
        ) : null}
        {user ? (
          <Button
            size="icon"
            asChild
            className="mt-3 flex rounded-full xl:hidden"
          >
            <Link href="/feed" aria-label="Post">
              +
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="px-2">
        {user ? (
          <SidebarUserMenu
            name={user.name}
            email={user.email}
            image={user.image}
            isAdmin={isAdmin}
            profileSlug={profileSlug}
          />
        ) : (
          <div className="flex flex-col gap-2 px-1">
            <Button variant="secondary" className="w-full rounded-full" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button className="hidden w-full rounded-full xl:flex" asChild>
              <Link href="/signup">Join Proverse</Link>
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
