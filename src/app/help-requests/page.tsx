import Link from "next/link";
import { listHelpRequests } from "@/lib/services/help-request-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function HelpRequestsPage() {
  const helpRequests = await listHelpRequests({});

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">Help requests</h1>
        <Button asChild>
          <Link href="/help-requests/new">Post a request</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {helpRequests.map((hr) => (
          <Link key={hr.id} href={`/help-requests/${hr.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg text-ink">{hr.title}</h3>
                  <Badge variant="outline">{hr.geoScope}</Badge>
                </div>
                <p className="line-clamp-2 text-sm text-ink-muted">{hr.description}</p>
                <p className="text-xs text-ink-muted">
                  by {hr.author.name} · {hr._count.responses} responses
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {helpRequests.length === 0 ? <p className="text-ink-muted">No open help requests yet.</p> : null}
      </div>
    </div>
  );
}
