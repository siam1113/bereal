import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Fraud-detection *assistance* (docs/roadmap/08-ai-assistance.md, "What to build" item
 * 5): deterministic, local heuristics over existing claim/relationship/endorsement/
 * feedback data that flag suspicious patterns into AiModerationFlag for human review.
 *
 * This NEVER auto-rejects, auto-confirms, auto-revokes, or otherwise mutates the
 * records it scans — it only upserts rows into AiModerationFlag (status PENDING),
 * which an admin then resolves exactly like a Report or RelationshipDispute (see
 * admin-ai-flag-service.ts). There is deliberately no LLM call and no numeric
 * "trust"/confidence score about a *person* anywhere here — each flag names a specific
 * reasonCode and cites the concrete record ids it looked at (evidenceRefs), consistent
 * with the product's "show evidence, never a blended score" rule applied to AI output.
 *
 * Thresholds are intentionally low/permissive for a cold-start, low-volume network —
 * tune upward once there's real usage data to calibrate against (same caution the
 * roadmap's stage gates ask for before any automated-verification investment).
 */

export const RAPID_CLAIM_BURST_THRESHOLD = 3;
export const RAPID_CLAIM_BURST_WINDOW_MS = 24 * 60 * 60 * 1000;
export const REPEATED_DISPUTE_THRESHOLD = 2;

export interface FraudSignalScanResult {
  rapidClaimBurstFlags: number;
  endorsementRingFlags: number;
  repeatedDisputeFlags: number;
}

export async function runFraudSignalScan(): Promise<FraudSignalScanResult> {
  const [rapidClaimBurstFlags, endorsementRingFlags, repeatedDisputeFlags] = await Promise.all([
    scanRapidClaimBursts(),
    scanEndorsementRings(),
    scanRepeatedDisputedDeclarations(),
  ]);
  return { rapidClaimBurstFlags, endorsementRingFlags, repeatedDisputeFlags };
}

/** A user submitting an unusually large number of claims in a short window — possible
 *  claim-farming / credential-stuffing rather than genuine incremental evidence. */
async function scanRapidClaimBursts(): Promise<number> {
  const claims = await prisma.credentialClaim.findMany({
    where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } },
    select: { id: true, subjectUserId: true, submittedAt: true, claimType: true, title: true },
    orderBy: { submittedAt: "asc" },
  });

  const bySubject = new Map<string, typeof claims>();
  for (const claim of claims) {
    const list = bySubject.get(claim.subjectUserId) ?? [];
    list.push(claim);
    bySubject.set(claim.subjectUserId, list);
  }

  let created = 0;
  for (const [subjectUserId, subjectClaims] of bySubject) {
    for (let i = 0; i + RAPID_CLAIM_BURST_THRESHOLD - 1 < subjectClaims.length; i++) {
      const windowClaims = subjectClaims.slice(i, i + RAPID_CLAIM_BURST_THRESHOLD);
      const first = windowClaims[0];
      const last = windowClaims[windowClaims.length - 1];
      const spanMs = last.submittedAt.getTime() - first.submittedAt.getTime();
      if (spanMs > RAPID_CLAIM_BURST_WINDOW_MS) continue;

      const target = last;
      const didCreate = await upsertFlag({
        targetType: "CREDENTIAL_CLAIM",
        targetId: target.id,
        reasonCode: "RAPID_CLAIM_BURST",
        explanation:
          `${windowClaims.length} claims submitted by the same user within ` +
          `${Math.round(spanMs / 36e5)}h of each other — review for genuine incremental ` +
          "evidence vs. claim-farming.",
        evidenceRefs: {
          subjectUserId,
          claimIds: windowClaims.map((c) => c.id),
          claimTypes: windowClaims.map((c) => c.claimType),
          firstSubmittedAt: first.submittedAt.toISOString(),
          lastSubmittedAt: last.submittedAt.toISOString(),
        },
      });
      if (didCreate) created++;
      // Only flag the first qualifying window per subject per scan run — avoids one
      // burst producing an overlapping flag per sliding-window position.
      break;
    }
  }
  return created;
}

/** Two users whose only backing relationship is still SELF_DECLARED (never confirmed
 *  by either side) endorsing each other — a classic endorsement-ring shape where
 *  neither endorsement has independent confirmation behind it. */
async function scanEndorsementRings(): Promise<number> {
  const unverified = await prisma.endorsement.findMany({
    where: { status: "UNVERIFIED" },
    select: { id: true, endorserUserId: true, subjectUserId: true, relationshipId: true, skillId: true, createdAt: true },
  });

  const byPairKey = new Map<string, typeof unverified>();
  for (const endorsement of unverified) {
    const key = [endorsement.endorserUserId, endorsement.subjectUserId].sort().join(":");
    const list = byPairKey.get(key) ?? [];
    list.push(endorsement);
    byPairKey.set(key, list);
  }

  let created = 0;
  for (const pair of byPairKey.values()) {
    const forward = pair[0];
    if (!forward) continue;
    const reciprocal = pair.find(
      (e) => e.endorserUserId === forward.subjectUserId && e.subjectUserId === forward.endorserUserId,
    );
    if (!reciprocal || reciprocal.id === forward.id) continue;

    for (const endorsement of [forward, reciprocal]) {
      const other = endorsement.id === forward.id ? reciprocal : forward;
      const didCreate = await upsertFlag({
        targetType: "ENDORSEMENT",
        targetId: endorsement.id,
        reasonCode: "ENDORSEMENT_RING_SUSPECTED",
        explanation:
          "This endorsement and endorsement " +
          `${other.id} form a reciprocal pair between the same two users, and neither ` +
          "is backed by a mutually confirmed relationship — review for a possible " +
          "endorsement ring.",
        evidenceRefs: {
          thisEndorsementId: endorsement.id,
          reciprocalEndorsementId: other.id,
          relationshipIds: [endorsement.relationshipId, other.relationshipId],
          endorserUserId: endorsement.endorserUserId,
          subjectUserId: endorsement.subjectUserId,
        },
      });
      if (didCreate) created++;
    }
  }
  return created;
}

/** A user whose self-declared relationships have been disputed by their named
 *  counterpart more than once — a pattern worth a human look, distinct from any single
 *  dispute (which already has its own, non-AI review queue at /admin/disputes). */
async function scanRepeatedDisputedDeclarations(): Promise<number> {
  const disputes = await prisma.relationshipDispute.findMany({
    where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
    select: {
      id: true,
      relationshipId: true,
      relationship: { select: { id: true, declaredByUserId: true } },
    },
  });

  const byDeclarer = new Map<string, typeof disputes>();
  for (const dispute of disputes) {
    const declarerId = dispute.relationship.declaredByUserId;
    const list = byDeclarer.get(declarerId) ?? [];
    list.push(dispute);
    byDeclarer.set(declarerId, list);
  }

  let created = 0;
  for (const [declaredByUserId, declarerDisputes] of byDeclarer) {
    if (declarerDisputes.length < REPEATED_DISPUTE_THRESHOLD) continue;
    const relationshipIds = declarerDisputes.map((d) => d.relationshipId);
    const disputeIds = declarerDisputes.map((d) => d.id);

    for (const dispute of declarerDisputes) {
      const didCreate = await upsertFlag({
        targetType: "RELATIONSHIP",
        targetId: dispute.relationshipId,
        reasonCode: "REPEATED_DISPUTED_SELF_DECLARATION",
        explanation:
          `The user who declared this relationship has ${declarerDisputes.length} ` +
          "open/under-review disputes raised against their self-declared relationships " +
          "— review the pattern, not just this one dispute (already queued separately " +
          "at /admin/disputes).",
        evidenceRefs: { declaredByUserId, relationshipIds, disputeIds },
      });
      if (didCreate) created++;
    }
  }
  return created;
}

async function upsertFlag(input: {
  targetType: "CREDENTIAL_CLAIM" | "RELATIONSHIP" | "ENDORSEMENT" | "PROFESSIONAL_FEEDBACK";
  targetId: string;
  reasonCode: string;
  explanation: string;
  evidenceRefs: Record<string, unknown>;
}): Promise<boolean> {
  const existing = await prisma.aiModerationFlag.findUnique({
    where: {
      targetType_targetId_reasonCode: {
        targetType: input.targetType,
        targetId: input.targetId,
        reasonCode: input.reasonCode,
      },
    },
  });
  if (existing) return false;

  await prisma.aiModerationFlag.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      reasonCode: input.reasonCode,
      explanation: input.explanation,
      evidenceRefs: input.evidenceRefs as Prisma.InputJsonValue,
    },
  });
  return true;
}
