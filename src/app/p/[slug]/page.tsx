import { notFound } from "next/navigation";
import Link from "next/link";
import { getProfileBySlug } from "@/lib/services/profile-service";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

const STAGE_LABEL: Record<string, string> = {
  LEARNING: "Learning",
  EMERGING: "Emerging",
  PRACTICING: "Practicing",
  ESTABLISHED: "Established",
};

const AVAILABILITY_LABEL: Record<string, string> = {
  OPEN_TO_WORK: "Open to work",
  OPEN_TO_COLLAB: "Open to collaborate",
  LIMITED: "Limited availability",
  NOT_AVAILABLE: "Not available",
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile) notFound();

  const session = await auth();
  const isOwnProfile = session?.user?.id === profile.user.id;

  const primarySkill = profile.personSkills.find((ps) => ps.isPrimary);
  const secondarySkills = profile.personSkills.filter((ps) => !ps.isPrimary);

  const location = [profile.city, profile.region, profile.country].filter(Boolean).join(", ");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            {profile.user.image ? <AvatarImage src={profile.user.image} alt={profile.displayName} /> : null}
            <AvatarFallback className="text-xl">{profile.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-2xl font-medium text-ink">{profile.displayName}</h1>
            {location ? <p className="text-sm text-ink-muted">{location}</p> : null}
            <p className="text-sm text-ink-muted">{AVAILABILITY_LABEL[profile.availability]}</p>
          </div>
        </div>
        {isOwnProfile ? (
          <Link href="/settings/profile" className="text-sm text-accent hover:underline">
            Edit profile
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {primarySkill ? (
          <Badge variant="accent">
            {primarySkill.skill.name} · {STAGE_LABEL[primarySkill.stage]}
          </Badge>
        ) : null}
        {secondarySkills.map((ps) => (
          <Badge key={ps.id} variant="neutral">
            {ps.skill.name} · {STAGE_LABEL[ps.stage]}
          </Badge>
        ))}
      </div>

      {profile.bio ? <p className="max-w-2xl text-ink">{profile.bio}</p> : null}

      {/* relationships/claims/badges: wired in during integration */}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-medium text-ink">Portfolio</h2>
        {profile.portfolioItems.length === 0 ? (
          <p className="text-sm text-ink-muted">No public portfolio items yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {profile.portfolioItems.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {item.description ? (
                    <p className="text-sm text-ink-muted">{item.description}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-medium text-ink">Experience</h2>
        {profile.experienceEntries.length === 0 ? (
          <p className="text-sm text-ink-muted">No experience entries yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {profile.experienceEntries.map((entry) => (
              <li key={entry.id} className="rounded-md border border-border p-4">
                <p className="font-medium text-ink">
                  {entry.title} · {entry.organizationName}
                </p>
                <p className="text-sm text-ink-muted">
                  {new Date(entry.startDate).getFullYear()}
                  {entry.endDate ? ` – ${new Date(entry.endDate).getFullYear()}` : " – present"}
                </p>
                {entry.description ? (
                  <p className="mt-1 text-sm text-ink-muted">{entry.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
