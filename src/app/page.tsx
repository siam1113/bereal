import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const categories = [
  "Carpentry & trades",
  "Tailoring & textile craft",
  "Agriculture & farming",
  "Software & engineering",
  "Healthcare-adjacent care",
  "Visual & performing arts",
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="flex flex-col items-start gap-6">
        <p className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent">
          Every skill deserves to be seen
        </p>
        <h1 className="font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
          A professional network built for every kind of skill.
        </h1>
        <p className="max-w-2xl text-lg text-ink-muted">
          Carpenters and software engineers, tailors and consultants, farmers and
          designers — show real work, build a relationship graph that reflects how you
          actually worked together, and get discovered by the people who need you.
        </p>
        <div className="flex gap-3">
          <Button size="lg" asChild>
            <Link href="/signup">Join COMMON</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/discover">Explore the directory</Link>
          </Button>
        </div>
      </section>

      <section className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {categories.map((category) => (
          <Card key={category}>
            <CardContent className="p-4 text-sm font-medium text-ink">{category}</CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
