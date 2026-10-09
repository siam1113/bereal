import Link from "next/link";
import { listServiceOfferings } from "@/lib/services/service-offering-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ServicesPage() {
  const offerings = await listServiceOfferings({});

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-medium text-ink">Services</h1>
      <p className="mt-2 text-ink-muted">Browse services offered by people and businesses on COMMON.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {offerings.map((o) => (
          <Link key={o.id} href={`/services/${o.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 p-5">
                <h3 className="font-display text-lg text-ink">{o.title}</h3>
                <p className="line-clamp-2 text-sm text-ink-muted">{o.description}</p>
                <p className="text-xs text-ink-muted">
                  {o.business?.name ?? o.personProfile?.displayName}
                </p>
                <div className="flex gap-2">
                  {o.skill ? <Badge variant="neutral">{o.skill.name}</Badge> : null}
                  {o.priceNote ? <Badge variant="outline">{o.priceNote}</Badge> : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {offerings.length === 0 ? <p className="text-ink-muted">No services listed yet.</p> : null}
      </div>
    </div>
  );
}
