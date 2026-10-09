import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getMentoringOffer, listRequestsForOffer } from "@/lib/services/mentoring-service";
import { Badge } from "@/components/ui/badge";
import { MentoringRequestManager, RequestMentoringForm } from "@/components/learning/mentoring-offer-actions";

const FORMAT_LABEL: Record<string, string> = {
  ONE_ON_ONE: "One-on-one",
  GROUP: "Group",
  EITHER: "One-on-one or group",
};

const STAGE_LABEL: Record<string, string> = {
  LEARNING: "Learning",
  EMERGING: "Emerging",
  PRACTICING: "Practicing",
  ESTABLISHED: "Established",
};

export default async function MentoringOfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [offer, user] = await Promise.all([getMentoringOffer(id), getCurrentUser()]);
  if (!offer) notFound();

  const isMentor = user?.id === offer.mentorUserId;
  const requests = isMentor ? await listRequestsForOffer(offer.id, user!.id) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">{offer.title}</h1>
        {!offer.isActive ? <Badge variant="outline">Inactive</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        Mentor:{" "}
        {offer.mentor.personProfile ? (
          <Link href={`/p/${offer.mentor.personProfile.slug}`} className="underline">
            {offer.mentor.personProfile.displayName}
          </Link>
        ) : (
          offer.mentor.name
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="neutral">{offer.skill.name}</Badge>
        <Badge variant="outline">{FORMAT_LABEL[offer.format]}</Badge>
        <Badge variant="outline">Capacity {offer.capacity}</Badge>
        {offer.mentorStage ? (
          <Badge variant="outline" title="Evidence-based pathway stage, not a ranking of mentor quality">
            Stage: {STAGE_LABEL[offer.mentorStage]}
          </Badge>
        ) : null}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-ink">{offer.description}</p>

      {isMentor ? (
        <div className="mt-8">
          <h2 className="font-display text-xl text-ink">Requests</h2>
          <div className="mt-4">
            <MentoringRequestManager
              requests={requests.map((r) => ({
                id: r.id,
                message: r.message,
                status: r.status,
                mentee: r.mentee,
              }))}
            />
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Request mentoring</h2>
          <RequestMentoringForm offerId={offer.id} disabled={!user} />
          {!user ? <p className="mt-2 text-sm text-ink-muted">Sign in to request mentoring.</p> : null}
        </div>
      )}
    </div>
  );
}
