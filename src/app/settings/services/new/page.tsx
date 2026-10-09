import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ServiceOfferingForm } from "@/components/discover/service-offering-form";

export default async function NewServiceOfferingPage() {
  const user = await requireUser();
  const profile = await prisma.personProfile.findUnique({ where: { userId: user.id }, select: { id: true } });

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-2xl font-medium text-ink">Add a service</h1>
      <div className="mt-6">
        <ServiceOfferingForm mode="create" personProfileId={profile?.id} />
      </div>
    </div>
  );
}
