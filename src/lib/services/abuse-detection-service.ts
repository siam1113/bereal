import { prisma } from "@/lib/prisma";
import { createFlag } from "@/lib/services/moderation-flag-service";

/**
 * Abuse-pattern detection beyond basic rate limiting (docs/roadmap/09-trust-safety-
 * and-moderation.md, "what to build" #1). Detectors only ever call `createFlag` —
 * they never touch a user's data, never change relationship/endorsement state, and
 * never auto-action anything. A human triages every flag via
 * `moderation-flag-service.ts`.
 *
 * DETECTOR_ID is versioned so a later tuning pass can tell which flags came from
 * which heuristic version.
 */
const DETECTOR_ID = "endorsement-ring-detector@v1";

/**
 * Heuristic: reciprocal endorsements (A endorses B *and* B endorses A) where
 * neither backing relationship has any independent evidence attached
 * (`RelationshipEvidence`) and both endorsements are `UNVERIFIED` (i.e. riding on a
 * `SELF_DECLARED` relationship, never `MUTUALLY_CONFIRMED`/`EVIDENCE_REVIEWED`).
 * This is the simplest, most literal reading of "clusters of mutual confirmations
 * with no independent evidence" named in the track doc — it catches 2-person rings
 * (you endorse me, I endorse you, neither of us ever showed work). It intentionally
 * does NOT attempt to detect larger cycles (A endorses B endorses C endorses A) —
 * that needs real graph-cycle detection and a volume of real endorsement data to
 * tune against, and is left as a documented follow-up rather than guessed at here.
 *
 * What counts as "suspicious" above this literal reciprocity-plus-no-evidence
 * check (e.g. endorsing within minutes of connecting, endorsing many people in a
 * short window, endorsing-for-endorsement-back patterns across 3+ people) is a
 * product/policy threshold this track deliberately does not invent — see this
 * track's final report's "policy questions to flag" section.
 */
export async function detectEndorsementRings(): Promise<{ scanned: number; flagged: number }> {
  const endorsements = await prisma.endorsement.findMany({
    where: { status: "UNVERIFIED" },
    select: { id: true, endorserUserId: true, subjectUserId: true, relationshipId: true },
  });

  const byPair = new Map<string, { endorserUserId: string; subjectUserId: string; id: string; relationshipId: string }>();
  for (const e of endorsements) {
    byPair.set(`${e.endorserUserId}->${e.subjectUserId}`, e);
  }

  const seenPairs = new Set<string>();
  let flagged = 0;

  for (const e of endorsements) {
    const reciprocal = byPair.get(`${e.subjectUserId}->${e.endorserUserId}`);
    if (!reciprocal) continue;

    const pairKey = [e.endorserUserId, e.subjectUserId].sort().join(":");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const relationshipIds = [...new Set([e.relationshipId, reciprocal.relationshipId])];
    const evidenceCount = await prisma.relationshipEvidence.count({
      where: { relationshipId: { in: relationshipIds } },
    });
    if (evidenceCount > 0) continue;

    await createFlag({
      entityType: "ENDORSEMENT_CLUSTER",
      entityId: pairKey,
      patternType: "RECIPROCAL_ENDORSEMENT_NO_EVIDENCE",
      severity: "MEDIUM",
      detectorId: DETECTOR_ID,
      evidence: {
        userAId: e.endorserUserId,
        userBId: e.subjectUserId,
        endorsementIds: [e.id, reciprocal.id],
        relationshipIds,
      },
    });
    flagged += 1;
  }

  return { scanned: endorsements.length, flagged };
}

/** Run every registered detector. Intended to be called from an admin action today
 * (no scheduler exists in this app yet — see docs/architecture.md); wire to a cron
 * or job queue when one exists. */
export async function runAbuseDetectionScan() {
  const endorsementRings = await detectEndorsementRings();
  return { endorsementRings };
}
