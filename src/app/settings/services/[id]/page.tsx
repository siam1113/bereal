import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { getServiceOffering } from "@/lib/services/service-offering-service";
import { ServiceOfferingForm } from "@/components/discover/service-offering-form";

export default async function EditServiceOfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const offering = await getServiceOffering(id);
  if (!offering) notFound();

  const owns = offering.personProfile?.userId === user.id || offering.business?.ownerUserId === user.id;
  if (!owns) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-2xl font-medium text-ink">Edit service</h1>
      <div className="mt-6">
        <ServiceOfferingForm
          mode="edit"
          offeringId={offering.id}
          initial={{
            title: offering.title,
            description: offering.description,
            priceNote: offering.priceNote,
            skillId: offering.skillId,
            isActive: offering.isActive,
          }}
        />
      </div>
    </div>
  );
}
