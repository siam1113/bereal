import Link from "next/link";
import { Search } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

const exploreSkills = [
  "Carpentry & trades",
  "Tailoring & textile craft",
  "Agriculture & farming",
  "Software & engineering",
  "Healthcare-adjacent care",
  "Visual & performing arts",
];

export async function AppRightRail() {
  const session = await auth();
  const viewerId = session?.user?.id;

  const suggested = await prisma.personProfile.findMany({
    where: viewerId ? { userId: { not: viewerId } } : {},
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      slug: true,
      displayName: true,
      bio: true,
      user: { select: { image: true } },
    },
  });

  return (
    <aside className="sticky top-0 hidden h-dvh w-[350px] shrink-0 overflow-y-auto py-2 pl-6 pr-2 lg:block">
      <Link
        href="/discover"
        className="mb-4 flex items-center gap-3 rounded-full bg-surface px-4 py-2.5 text-ink-muted ring-1 ring-border transition-colors hover:ring-border-strong"
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span className="text-sm">Search Proverse</span>
      </Link>

      {suggested.length > 0 ? (
        <Card className="mb-4 overflow-hidden p-0">
          <p className="px-4 pt-4 pb-2 text-lg font-extrabold text-ink">Who to connect with</p>
          <div className="flex flex-col">
            {suggested.map((person) => (
              <Link
                key={person.slug}
                href={`/p/${person.slug}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent-soft"
              >
                <Avatar>
                  {person.user.image ? (
                    <AvatarImage src={person.user.image} alt={person.displayName} />
                  ) : null}
                  <AvatarFallback>{person.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {person.displayName}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {person.bio ?? "Proverse member"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <Link
            href="/discover"
            className="block px-4 py-3 text-sm text-accent hover:bg-accent-soft"
          >
            Show more
          </Link>
        </Card>
      ) : null}

      <Card className="mb-4 overflow-hidden p-0">
        <p className="px-4 pt-4 pb-2 text-lg font-extrabold text-ink">Explore skills</p>
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {exploreSkills.map((skill) => (
            <Link
              key={skill}
              href="/discover"
              className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {skill}
            </Link>
          ))}
        </div>
      </Card>

      <nav className="flex flex-wrap gap-x-3 gap-y-1 px-2 text-xs text-ink-muted">
        <Link href="/discover" className="hover:underline">
          Discover
        </Link>
        <Link href="/opportunities" className="hover:underline">
          Opportunities
        </Link>
        <Link href="/help-requests" className="hover:underline">
          Help requests
        </Link>
        <Link href="/settings/privacy" className="hover:underline">
          Privacy
        </Link>
        <span>&copy; Proverse</span>
      </nav>
    </aside>
  );
}
