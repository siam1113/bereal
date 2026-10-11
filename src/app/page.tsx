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
    <div className="mx-auto px-4 py-10 sm:px-8 sm:py-14">
      <section className="flex flex-col items-start gap-5">
        <p className="animate-fade-in-up rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          Every skill deserves to be seen
        </p>
        <h1 className="animate-fade-in-up text-4xl font-extrabold leading-[1.05] tracking-tight text-ink [animation-delay:80ms] sm:text-5xl">
          A professional network built for{" "}
          <span className="text-gradient-brand">every kind of skill</span>.
        </h1>
        <p className="animate-fade-in-up max-w-xl text-lg text-ink-muted [animation-delay:140ms]">
          Carpenters and software engineers, tailors and consultants, farmers and
          designers — show real work, build a relationship graph that reflects how you
          actually worked together, and get discovered by the people who need you.
        </p>
        <div className="animate-fade-in-up flex gap-3 [animation-delay:200ms]">
          <Button size="lg" asChild>
            <Link href="/signup">Join Proverse</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/discover">Explore the directory</Link>
          </Button>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((category, i) => (
          <Card
            key={category}
            className="animate-fade-in-up"
            style={{ animationDelay: `${240 + i * 40}ms` }}
          >
            <CardContent className="p-4 text-sm font-semibold text-ink">{category}</CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
