import { notFound } from "next/navigation";
import Link from "next/link";
import { getBusinessBySlug, getMembershipForViewer, recordStorefrontView } from "@/lib/services/business-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MembershipStatusPanel } from "@/components/business/membership-status-panel";
import { auth } from "@/lib/auth";

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const isOwner = viewerId === business.ownerUserId;
  const location = [business.city, business.region, business.country].filter(Boolean).join(", ");

  // Fire-and-forget storefront view tracking (aggregate-only analytics — see
  // business-service.ts#recordStorefrontView). Never blocks the page render.
  void recordStorefrontView(business.id, viewerId);

  const viewerMembership = isOwner ? null : await getMembershipForViewer(business.id, viewerId);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">{business.name}</h1>
          {location ? <p className="text-sm text-ink-muted">{location}</p> : null}
        </div>
        {isOwner ? (
          <div className="flex items-center gap-4">
            <Link href={`/settings/businesses/${business.id}/analytics`} className="text-sm text-accent hover:underline">
              Analytics
            </Link>
            <Link href={`/settings/businesses/${business.id}`} className="text-sm text-accent hover:underline">
              Manage
            </Link>
          </div>
        ) : session?.user ? (
          <MembershipStatusPanel businessId={business.id} membership={viewerMembership} />
        ) : null}
      </div>

      {business.description ? <p className="max-w-2xl text-ink">{business.description}</p> : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-medium text-ink">Team</h2>
        {business.memberships.length === 0 ? (
          <p className="text-sm text-ink-muted">No confirmed team members yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {business.memberships.map((m) => (
              <Link
                key={m.userId}
                href={m.user.personProfile ? `/p/${m.user.personProfile.slug}` : "#"}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent-soft"
              >
                <span>
                  {m.user.personProfile?.displayName ?? m.user.name} · {m.role}
                </span>
                {m.verificationClaim?.status === "APPROVED" ? (
                  <Badge variant="success">Verified</Badge>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-medium text-ink">Services</h2>
        {business.serviceOfferings.length === 0 ? (
          <p className="text-sm text-ink-muted">No active services listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {business.serviceOfferings.map((service) => (
              <Card key={service.id}>
                <CardHeader>
                  <CardTitle className="text-base">{service.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="text-sm text-ink-muted">{service.description}</p>
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    {service.skill ? <Badge variant="outline">{service.skill.name}</Badge> : null}
                    {service.priceNote ? <span>{service.priceNote}</span> : null}
                  </div>
                  <Link href={`/services/${service.id}`} className="text-sm text-accent hover:underline">
                    View & inquire
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-medium text-ink">Portfolio</h2>
        {business.portfolioItems.length === 0 ? (
          <p className="text-sm text-ink-muted">No public portfolio items yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {business.portfolioItems.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {item.description ? <p className="text-sm text-ink-muted">{item.description}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
