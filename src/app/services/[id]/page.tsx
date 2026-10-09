import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceOffering } from "@/lib/services/service-offering-service";
import { Badge } from "@/components/ui/badge";
import { InquiryForm } from "@/components/discover/inquiry-form";

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offering = await getServiceOffering(id);
  if (!offering) notFound();

  const ownerName = offering.business?.name ?? offering.personProfile?.displayName;
  const ownerHref = offering.business
    ? `/business/${offering.business.slug}`
    : offering.personProfile
      ? `/p/${offering.personProfile.slug}`
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-medium text-ink">{offering.title}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Offered by {ownerHref ? <Link href={ownerHref} className="underline">{ownerName}</Link> : ownerName}
      </p>
      <div className="mt-3 flex gap-2">
        {offering.skill ? <Badge variant="neutral">{offering.skill.name}</Badge> : null}
        {offering.priceNote ? <Badge variant="outline">{offering.priceNote}</Badge> : null}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-ink">{offering.description}</p>

      <div className="mt-8">
        <h2 className="mb-2 font-display text-xl text-ink">Send an inquiry</h2>
        <InquiryForm offeringId={offering.id} />
      </div>
    </div>
  );
}
