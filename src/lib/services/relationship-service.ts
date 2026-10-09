import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { openReviewCase } from "@/lib/services/review-case-service";
import { recordSafetyMetricEvent } from "@/lib/services/safety-metrics-service";
import type {
  ConsentStatus,
  Prisma,
  Relationship,
  RelationshipIntent,
  RelationshipType,
  Visibility,
} from "@prisma/client";

export class RelationshipAuthError extends Error {}
export class RelationshipStateError extends Error {}

/**
 * Role label each party gets on a Relationship row, per type. Symmetric types repeat the
 * type name on both sides; asymmetric types get distinct role labels. Validated here so
 * callers can't invent arbitrary role strings.
 */
export const RELATIONSHIP_ROLE_MAP: Record<RelationshipType, [string, string]> = {
  WORKED_WITH: ["WORKED_WITH", "WORKED_WITH"],
  COLLEAGUE: ["COLLEAGUE", "COLLEAGUE"],
  COLLABORATOR: ["COLLABORATOR", "COLLABORATOR"],
  CLIENT_PROVIDER: ["CLIENT", "PROVIDER"],
  MENTOR_MENTEE: ["MENTOR", "MENTEE"],
  CONSULTANT_CLIENT: ["CONSULTANT", "CLIENT"],
  BUSINESS_PARTNER: ["BUSINESS_PARTNER", "BUSINESS_PARTNER"],
  FRIEND: ["FRIEND", "FRIEND"],
  FAMILY: ["FAMILY", "FAMILY"],
  LEARNING_FROM: ["LEARNER", "SUBJECT"],
};

function rolesFor(type: RelationshipType, fromIsPartyA: boolean): [string, string] {
  const [a, b] = RELATIONSHIP_ROLE_MAP[type];
  return fromIsPartyA ? [a, b] : [b, a];
}

export async function createRelationshipRequest(input: {
  fromUserId: string;
  toUserId: string;
  proposedType: RelationshipType;
  intent: RelationshipIntent;
  message?: string;
}) {
  if (input.fromUserId === input.toUserId) {
    throw new RelationshipStateError("Cannot create a relationship with yourself");
  }
  return prisma.relationshipRequest.create({
    data: {
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      proposedType: input.proposedType,
      intent: input.intent,
      message: input.message,
    },
  });
}

export async function listMyRelationshipRequests(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    prisma.relationshipRequest.findMany({
      where: { toUserId: userId, status: "PENDING" },
      include: { from: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.relationshipRequest.findMany({
      where: { fromUserId: userId, status: "PENDING" },
      include: { to: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { incoming, outgoing };
}

/**
 * Accepting creates the actual Relationship (confirmationStatus starts SELF_DECLARED,
 * declared by the original requester — the counterpart accepting a *request* is not the
 * same thing as the counterpart *confirming* the relationship actually happened; those
 * are deliberately separate steps, see confirmRelationship below) plus default-PUBLIC
 * visibility rows for both parties. Declining just closes out the request.
 */
export async function respondToRelationshipRequest(
  requestId: string,
  responderUserId: string,
  accept: boolean,
): Promise<{ request: Prisma.RelationshipRequestGetPayload<object>; relationship?: Relationship }> {
  const request = await prisma.relationshipRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.toUserId !== responderUserId) {
    throw new RelationshipAuthError("Only the recipient can respond to this request");
  }
  if (request.status !== "PENDING") {
    throw new RelationshipStateError("Request already resolved");
  }

  if (!accept) {
    const declined = await prisma.relationshipRequest.update({
      where: { id: requestId },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    return { request: declined };
  }

  const [roleA] = rolesFor(request.proposedType, true);
  const [, roleB] = rolesFor(request.proposedType, true);
  const counterpartConsent: ConsentStatus = request.proposedType === "FAMILY" ? "PENDING" : "NOT_REQUIRED";

  const relationship = await prisma.$transaction(async (tx) => {
    const rel = await tx.relationship.create({
      data: {
        type: request.proposedType,
        partyAUserId: request.fromUserId,
        partyARole: roleA,
        partyBUserId: request.toUserId,
        partyBRole: roleB,
        state: "ACTIVE",
        confirmationStatus: "SELF_DECLARED",
        declaredByUserId: request.fromUserId,
        counterpartConsent,
      },
    });
    await tx.relationshipParticipantVisibility.createMany({
      data: [
        { relationshipId: rel.id, userId: request.fromUserId, visibility: "PUBLIC" },
        { relationshipId: rel.id, userId: request.toUserId, visibility: "PUBLIC" },
      ],
    });
    await tx.relationshipRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED", respondedAt: new Date(), resultingRelationshipId: rel.id },
    });
    return rel;
  });

  return { request: { ...request, status: "ACCEPTED" }, relationship };
}

/**
 * The declaring party can never confirm their own declaration — confirmation must come
 * from the counterpart, or it's meaningless self-attestation wearing a "confirmed" badge.
 */
export async function confirmRelationship(relationshipId: string, confirmingUserId: string): Promise<Relationship> {
  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: relationshipId } });

  if (rel.declaredByUserId === confirmingUserId) {
    throw new RelationshipAuthError("The declaring party cannot confirm their own declaration");
  }
  if (rel.partyAUserId !== confirmingUserId && rel.partyBUserId !== confirmingUserId) {
    throw new RelationshipAuthError("Only a party to this relationship can confirm it");
  }
  if (rel.confirmationStatus === "MUTUALLY_CONFIRMED") return rel;

  const updated = await prisma.relationship.update({
    where: { id: relationshipId },
    data: { confirmationStatus: "MUTUALLY_CONFIRMED" },
  });
  await logAudit({
    actorUserId: confirmingUserId,
    action: "relationship.confirm",
    targetType: "Relationship",
    targetId: relationshipId,
  });
  return updated;
}

/** Grants/denies the FAMILY-type consent gate for showing the counterpart's identity publicly. */
export async function respondToFamilyConsent(
  relationshipId: string,
  respondingUserId: string,
  grant: boolean,
): Promise<Relationship> {
  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: relationshipId } });
  if (rel.type !== "FAMILY") throw new RelationshipStateError("Consent only applies to FAMILY relationships");
  if (rel.declaredByUserId === respondingUserId) {
    throw new RelationshipAuthError("The declaring party cannot grant their own consent");
  }
  return prisma.relationship.update({
    where: { id: relationshipId },
    data: { counterpartConsent: grant ? "GRANTED" : "DENIED" },
  });
}

/** Whether the counterpart's identity may be shown attached to this relationship publicly. */
export function canShowCounterpartIdentity(rel: Pick<Relationship, "type" | "counterpartConsent">): boolean {
  if (rel.type !== "FAMILY") return true;
  return rel.counterpartConsent === "GRANTED";
}

/** Only ever updates the caller's own visibility row — never the counterpart's. */
export async function setParticipantVisibility(
  relationshipId: string,
  userId: string,
  visibility: Visibility,
  hidden: boolean,
) {
  const participant = await prisma.relationshipParticipantVisibility.findUnique({
    where: { relationshipId_userId: { relationshipId, userId } },
  });
  if (!participant) throw new RelationshipAuthError("Not a participant on this relationship");

  return prisma.relationshipParticipantVisibility.update({
    where: { relationshipId_userId: { relationshipId, userId } },
    data: { visibility, hidden },
  });
}

export async function addRelationshipEvidence(input: {
  relationshipId: string;
  description: string;
  portfolioItemId?: string;
  url?: string;
  addedByUserId: string;
}) {
  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: input.relationshipId } });
  if (rel.partyAUserId !== input.addedByUserId && rel.partyBUserId !== input.addedByUserId) {
    throw new RelationshipAuthError("Only a party to this relationship can add evidence");
  }
  return prisma.relationshipEvidence.create({ data: input });
}

export async function raiseDispute(relationshipId: string, raisedByUserId: string, reason: string) {
  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: relationshipId } });
  if (rel.partyAUserId !== raisedByUserId && rel.partyBUserId !== raisedByUserId) {
    throw new RelationshipAuthError("Only a party to this relationship can dispute it");
  }
  const dispute = await prisma.relationshipDispute.create({
    data: { relationshipId, raisedByUserId, reason },
  });
  await logAudit({
    actorUserId: raisedByUserId,
    action: "relationship.dispute.raise",
    targetType: "Relationship",
    targetId: relationshipId,
    metadata: { reason },
  });

  // Track 9 (trust/safety/moderation): open the generic workflow envelope (SLA,
  // tier, assignment) for this dispute. The dispute's own `status` stays the
  // source of truth for the actual outcome — see prisma/schema.prisma's
  // `ReviewCase` doc comment for the full contract.
  const counterpartUserId = rel.partyAUserId === raisedByUserId ? rel.partyBUserId : rel.partyAUserId;
  await openReviewCase({
    caseType: "DISPUTE",
    entityType: "RELATIONSHIP_DISPUTE",
    entityId: dispute.id,
    subjectUserId: counterpartUserId,
    actorUserId: raisedByUserId,
  });
  await recordSafetyMetricEvent({
    metricType: "DISPUTE_OPENED",
    entityType: "RELATIONSHIP_DISPUTE",
    entityId: dispute.id,
    actorUserId: raisedByUserId,
  });

  return dispute;
}

export async function listMyRelationships(userId: string) {
  return prisma.relationship.findMany({
    where: { OR: [{ partyAUserId: userId }, { partyBUserId: userId }] },
    include: {
      partyA: { select: { id: true, name: true } },
      partyB: { select: { id: true, name: true } },
      visibilities: { where: { userId } },
      disputes: { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRelationshipDetail(relationshipId: string, viewerUserId: string) {
  const rel = await prisma.relationship.findUnique({
    where: { id: relationshipId },
    include: {
      partyA: { select: { id: true, name: true } },
      partyB: { select: { id: true, name: true } },
      visibilities: true,
      evidence: { orderBy: { createdAt: "desc" } },
      disputes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!rel) return null;
  if (rel.partyAUserId !== viewerUserId && rel.partyBUserId !== viewerUserId) {
    throw new RelationshipAuthError("Not a participant on this relationship");
  }
  return rel;
}
