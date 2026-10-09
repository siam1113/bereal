import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { listMyCircles } from "@/lib/services/learning-circle-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MyLearningCirclesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/learning-circles/mine");

  const memberships = await listMyCircles(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium text-ink">My learning circles</h1>
      <div className="mt-6 flex flex-col gap-3">
        {memberships.length === 0 ? (
          <p className="text-sm text-ink-muted">You haven&apos;t joined a learning circle yet.</p>
        ) : null}
        {memberships.map((m) => (
          <Link key={m.circleId} href={`/learning-circles/${m.circleId}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-ink">{m.circle.title}</p>
                  {m.circle.skill ? <p className="text-xs text-ink-muted">{m.circle.skill.name}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{m.role}</Badge>
                  <Badge variant="outline">{m.status}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
