import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { RelationshipAuthError, RelationshipStateError } from "@/lib/services/relationship-service";
import type { Prisma, Visibility } from "@prisma/client";

/**
 * Track 2 (identity & evidence): a Reference is a structured, scoped assessment one
 * person leaves about another — the third evidence tier above self-claim and
 * admin-reviewed claim. It is a STRONGER gate than Endorsement/ProfessionalFeedback:
 * those only require a *declared* relationship (status recomputed as UNVERIFIED if
 * not confirmed); a Reference can only be created at all once the backing
 * relationship is already MUTUALLY_CONFIRMED or EVIDENCE_REVIEWED. There is no
 * "unverified reference" state — if the relationship isn't confirmed yet, the author
 * can't submit one yet.
 *
 * A Reference never mutates ProfessionalStage or mints a badge by itself — it is
 * evidence for a human admin/stage process to consider, same as every other claim
 * type in this app (see docs/decisions.md: stage assignment is admin-manual, not a
 * rules engine).
 */

export async function createReference(input: {
  authorUserId: string;
  subjectUserId: string;
  relationshipId: string;
  attributes: Prisma.InputJsonValue;
  comment?: string;
}) {
  if (input.authorUserId === input.subjectUserId) {
    throw new RelationshipStateError("Cannot write a reference about yourself");
  }

  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: input.relationshipId } });
  const involvesBoth =
    (rel.partyAUserId === input.authorUserId && rel.partyBUserId === input.subjectUserId) ||
    (rel.partyBUserId === input.authorUserId && rel.partyAUserId === input.subjectUserId);
  if (!involvesBoth) {
    throw new RelationshipAuthError("Reference must be backed by a relationship between author and subject");
  }

  // The stronger gate: unlike endorsements/feedback (which accept a merely
  // self-declared relationship and just mark the result UNVERIFIED), a reference
  // can't be submitted at all until the relationship is independently confirmed.
  const isConfirmed = rel.confirmationStatus === "MUTUALLY_CONFIRMED" || rel.confirmationStatus === "EVIDENCE_REVIEWED";
  if (!isConfirmed) {
    throw new RelationshipAuthError(
      "A reference requires a mutually confirmed (or evidence-reviewed) relationship — self-declared isn't enough",
    );
  }

  const reference = await prisma.reference.create({
    data: {
      authorUserId: input.authorUserId,
      subjectUserId: input.subjectUserId,
      relationshipId: input.relationshipId,
      attributes: input.attributes,
      comment: input.comment,
    },
  });

  await logAudit({
    actorUserId: input.authorUserId,
    action: "reference.create",
    targetType: "Reference",
    targetId: reference.id,
    metadata: { subjectUserId: input.subjectUserId, relationshipId: input.relationshipId },
  });

  return reference;
}

/**
 * For public profile rendering (see profile-relationships-panel.tsx) — returns every
 * non-revoked, non-expired reference for a subject, with the subject's own
 * `visibility` field attached so the caller can apply the same
 * "PUBLIC -> everyone, CONNECTIONS -> any signed-in viewer, PRIVATE -> parties only"
 * rule used for relationship visibility. DISPUTED references are still included
 * (never silently hidden by a dispute alone) but the caller should render that status
 * visibly rather than presenting them as settled.
 */
export async function listReferencesForProfile(subjectUserId: string) {
  const references = await prisma.reference.findMany({
    where: { subjectUserId, status: { not: "REVOKED" } },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return references.filter((reference) => !isReferenceExpired(reference));
}

export async function listReferencesReceived(subjectUserId: string) {
  return prisma.reference.findMany({
    where: { subjectUserId },
    include: {
      author: { select: { id: true, name: true } },
      relationship: { select: { id: true, type: true, confirmationStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listReferencesAuthored(authorUserId: string) {
  return prisma.reference.findMany({
    where: { authorUserId },
    include: {
      subject: { select: { id: true, name: true } },
      relationship: { select: { id: true, type: true, confirmationStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReferenceDetail(referenceId: string, viewerUserId: string) {
  const reference = await prisma.reference.findUnique({
    where: { id: referenceId },
    include: {
      author: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      relationship: { select: { id: true, type: true, confirmationStatus: true } },
      disputes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!reference) return null;
  if (reference.authorUserId !== viewerUserId && reference.subjectUserId !== viewerUserId) {
    // Visibility beyond the two direct parties is enforced by the caller (profile
    // rendering checks `visibility`/`status`), same split as relationship visibility:
    // this function just guards "is this a legitimate party or do they need the
    // public-facing, visibility-filtered view instead."
    throw new RelationshipAuthError("Not a party to this reference");
  }
  return reference;
}

/** Only the subject may control whether a reference about them is shown publicly. */
export async function setReferenceVisibility(referenceId: string, subjectUserId: string, visibility: Visibility) {
  const reference = await prisma.reference.findUniqueOrThrow({ where: { id: referenceId } });
  if (reference.subjectUserId !== subjectUserId) {
    throw new RelationshipAuthError("Only the subject of a reference can change its visibility");
  }
  return prisma.reference.update({ where: { id: referenceId }, data: { visibility } });
}

/**
 * The subject's path to contest a reference written about them. Mirrors
 * raiseDispute() in relationship-service.ts: marks the reference DISPUTED (still
 * visible as disputed, never silently removed) and opens a ReferenceDispute for the
 * admin queue.
 */
export async function disputeReference(referenceId: string, raisedByUserId: string, reason: string) {
  const reference = await prisma.reference.findUniqueOrThrow({ where: { id: referenceId } });
  if (reference.subjectUserId !== raisedByUserId) {
    throw new RelationshipAuthError("Only the subject of a reference can dispute it");
  }
  if (reference.status === "REVOKED") {
    throw new RelationshipStateError("This reference has already been revoked");
  }

  const [, dispute] = await prisma.$transaction([
    prisma.reference.update({ where: { id: referenceId }, data: { status: "DISPUTED" } }),
    prisma.referenceDispute.create({ data: { referenceId, raisedByUserId, reason } }),
  ]);

  await logAudit({
    actorUserId: raisedByUserId,
    action: "reference.dispute.raise",
    targetType: "Reference",
    targetId: referenceId,
    metadata: { reason },
  });

  return dispute;
}

/**
 * Explicit admin action to revoke a reference (e.g. after upholding a dispute).
 * Deliberately separate from dispute resolution — see ReferenceDispute's doc comment
 * in schema.prisma for why status changes always go through a direct, attributable
 * action rather than being an implicit side effect of resolving a dispute.
 */
export async function revokeReference(referenceId: string, adminUserId: string, reason: string) {
  const reference = await prisma.reference.update({
    where: { id: referenceId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason },
  });
  await logAudit({
    actorUserId: adminUserId,
    action: "reference.revoke",
    targetType: "Reference",
    targetId: referenceId,
    metadata: { reason },
  });
  return reference;
}

/**
 * Lazy expiry check — there's no scheduler/cron in this app (see architecture.md), so
 * expiry is evaluated on read rather than flipped by a background job. Callers that
 * render references publicly should skip ones this returns true for, same way they'd
 * skip a REVOKED one.
 */
export function isReferenceExpired(reference: { expiresAt: Date | null }): boolean {
  return Boolean(reference.expiresAt && reference.expiresAt.getTime() < Date.now());
}
