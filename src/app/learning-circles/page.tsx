import Link from "next/link";
import { listLearningCircles } from "@/lib/services/learning-circle-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function LearningCirclesPage() {
  const circles = await listLearningCircles({});

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">Learning circles</h1>
          <p className="mt-1 text-ink-muted">Small-group learning — not just one-to-one mentoring.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/learning-circles/mine">My circles</Link>
          </Button>
          <Button asChild>
            <Link href="/learning-circles/new">Start a circle</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {circles.map((circle) => (
          <Link key={circle.id} href={`/learning-circles/${circle.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 p-5">
                <h3 className="font-display text-lg text-ink">{circle.title}</h3>
                {circle.description ? (
                  <p className="line-clamp-2 text-sm text-ink-muted">{circle.description}</p>
                ) : null}
                <p className="text-xs text-ink-muted">Started by {circle.creator.name}</p>
                <div className="flex flex-wrap gap-2">
                  {circle.skill ? <Badge variant="neutral">{circle.skill.name}</Badge> : null}
                  <Badge variant="outline">{circle.geoScope}</Badge>
                  <Badge variant="outline">
                    {circle._count.memberships}/{circle.capacity} members
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {circles.length === 0 ? <p className="text-ink-muted">No learning circles yet.</p> : null}
      </div>
    </div>
  );
}
