import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canShowCounterpartIdentity } from "@/lib/services/relationship-service";
import { listBadgesForUser } from "@/lib/services/badge-service";
import { listEndorsementsReceived } from "@/lib/services/endorsement-service";
import { listFeedbackReceived } from "@/lib/services/feedback-service";
import { listReferencesForProfile } from "@/lib/services/reference-service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Self-contained drop-in for a public profile page. Renders profileUserId's visible
 * relationships, badges, endorsements, and feedback as seen by viewerUserId.
 *
 * Visibility rule: only profileUserId's OWN RelationshipParticipantVisibility row is
 * checked (never the counterpart's) — each participant controls visibility on their own
 * profile only, per plan invariant. PUBLIC -> any visitor. PRIVATE -> only the two
 * parties. CONNECTIONS -> any signed-in visitor (V1 simplification: this app's
 * "connections" concept IS the relationship graph itself, so there's no independent
 * connections list to check against; documented rather than attempting a circular
 * definition).
 *
 * FAMILY relationships additionally redact the counterpart's name unless
 * counterpartConsent is GRANTED (canShowCounterpartIdentity), even if visibility is PUBLIC.
 */
export async function ProfileRelationshipsPanel({
  profileUserId,
  viewerUserId,
}: {
  profileUserId: string;
  viewerUserId: string | null;
}) {
  const relationships = await prisma.relationship.findMany({
    where: { OR: [{ partyAUserId: profileUserId }, { partyBUserId: profileUserId }] },
    include: {
      partyA: { select: { id: true, name: true } },
      partyB: { select: { id: true, name: true } },
      visibilities: { where: { userId: profileUserId } },
    },
    orderBy: { createdAt: "desc" },
  });

  const visible = relationships.filter((rel) => {
    const isParty = viewerUserId === rel.partyAUserId || viewerUserId === rel.partyBUserId;
    if (isParty) return true;

    const myVisibility = rel.visibilities[0];
    if (!myVisibility || myVisibility.hidden) return false;
    if (myVisibility.visibility === "PRIVATE") return false;
    if (myVisibility.visibility === "CONNECTIONS") return Boolean(viewerUserId);
    return true;
  });

  const [badges, endorsements, feedback, allReferences] = await Promise.all([
    listBadgesForUser(profileUserId),
    listEndorsementsReceived(profileUserId),
    listFeedbackReceived(profileUserId),
    listReferencesForProfile(profileUserId),
  ]);

  // Same per-viewer visibility rule as relationships, but on the Reference's own
  // `visibility` field (subject-controlled) rather than a separate join table —
  // there's only ever one side that can render a Reference (the subject's profile).
  const isProfileOwner = viewerUserId === profileUserId;
  const visibleReferences = allReferences.filter((reference) => {
    if (isProfileOwner || viewerUserId === reference.authorUserId) return true;
    if (reference.visibility === "PRIVATE") return false;
    if (reference.visibility === "CONNECTIONS") return Boolean(viewerUserId);
    return true;
  });

  return (
    <div className="flex flex-col gap-8">
      {badges.length > 0 ? (
        <section>
          <h2 className="font-display text-lg font-medium text-ink">Badges</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.map((award) => (
              <Link key={award.id} href={`/badges/${award.id}`}>
                <Badge variant="accent">{award.badgeDefinition.name}</Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-lg font-medium text-ink">Relationships</h2>
        <div className="mt-3 flex flex-col gap-2">
          {visible.length === 0 ? (
            <p className="text-sm text-ink-muted">No publicly visible relationships.</p>
          ) : (
            visible.map((rel) => {
              const counterpart = rel.partyAUserId === profileUserId ? rel.partyB : rel.partyA;
              const showIdentity = canShowCounterpartIdentity(rel);
              return (
                <Card key={rel.id}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {rel.type.replace(/_/g, " ")}
                        {showIdentity ? ` with ${counterpart.name ?? "someone"}` : " (details private)"}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {rel.confirmationStatus === "SELF_DECLARED"
                          ? "Self-declared"
                          : rel.confirmationStatus.replace(/_/g, " ")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {endorsements.length > 0 ? (
        <section>
          <h2 className="font-display text-lg font-medium text-ink">Endorsements</h2>
          <div className="mt-3 flex flex-col gap-2">
            {endorsements.map((e) => (
              <Card key={e.id}>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm text-ink">
                      <span className="font-medium">{e.skill.name}</span> — endorsed by{" "}
                      {e.endorser.name ?? "someone"}
                    </p>
                    {e.comment ? <p className="mt-1 text-xs text-ink-muted">{e.comment}</p> : null}
                  </div>
                  <Badge variant={e.status === "VERIFIED" ? "success" : "outline"}>
                    {e.status === "VERIFIED" ? "Verified" : "Unverified"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {feedback.length > 0 ? (
        <section>
          <h2 className="font-display text-lg font-medium text-ink">Professional feedback</h2>
          <div className="mt-3 flex flex-col gap-2">
            {feedback.map((f) => (
              <Card key={f.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-ink">From {f.author.name ?? "someone"}</p>
                    <Badge variant={f.isIndependentlyConfirmed ? "success" : "outline"}>
                      {f.isIndependentlyConfirmed ? "Confirmed relationship" : "Unconfirmed relationship"}
                    </Badge>
                  </div>
                  {f.comment ? <p className="mt-1 text-xs text-ink-muted">{f.comment}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {visibleReferences.length > 0 ? (
        <section>
          <h2 className="font-display text-lg font-medium text-ink">References</h2>
          <p className="mt-1 text-xs text-ink-muted">
            A structured reference from a mutually confirmed relationship — a stronger evidence
            tier than feedback, still reviewed by a human if disputed, never a trust score.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {visibleReferences.map((reference) => (
              <Link key={reference.id} href={`/references/${reference.id}`}>
                <Card className="transition-colors hover:border-border-strong">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <p className="text-sm text-ink">From {reference.author.name ?? "someone"}</p>
                    <Badge variant={reference.status === "DISPUTED" ? "warning" : "success"}>
                      {reference.status === "DISPUTED" ? "Disputed" : "Reference"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
