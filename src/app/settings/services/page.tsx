import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { listMyServiceOfferings } from "@/lib/services/service-offering-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function MyServicesPage() {
  const user = await requireUser();
  const offerings = await listMyServiceOfferings(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-ink">My services</h1>
        <Button asChild>
          <Link href="/settings/services/new">Add service</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {offerings.map((o) => (
          <Link key={o.id} href={`/settings/services/${o.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <h3 className="font-medium text-ink">{o.title}</h3>
                  <p className="text-xs text-ink-muted">{o.business?.name ?? "Personal"}</p>
                </div>
                <Badge variant={o.isActive ? "success" : "outline"}>{o.isActive ? "Active" : "Inactive"}</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
        {offerings.length === 0 ? <p className="text-ink-muted">You haven&apos;t listed any services yet.</p> : null}
      </div>
    </div>
  );
}
