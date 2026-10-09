import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { BusinessRelationshipPartyKind, BusinessRelationshipType, PartySide, Visibility } from "@prisma/client";

/**
 * Business-to-person and business-to-business relationships (Track 3 — relationships &
 * collaboration graph, see docs/roadmap/03-relationships-and-collaboration.md). Follows
 * the same self-declared -> mutually-confirmed, per-side-visibility, disputable shape as
 * the person-to-person Relationship model, but lives in its own table rather than
 * widening Relationship's party columns — see the schema comment above
 * BusinessRelationship for why.
 *
 * Scope note (deliberate simplification, not a policy question): unlike
 * RelationshipRequest's separate propose/accept handshake, creating a
 * BusinessRelationship is a single "declare" call. The load-bearing trust invariant
 * (the declarer can never be the one who confirms) is fully preserved via
 * confirmBusinessRelationship; the two-step handshake is a UX nicety, not a trust
 * invariant, so it wasn't duplicated here to keep this track's surface area contained.
 */

export class BusinessRelationshipAuthError extends Error {}
export class BusinessRelationshipStateError extends Error {}

export type BusinessRelationshipPartyInput =
  | { type: "PERSON"; userId: string }
  | { type: "BUSINESS"; businessId: string };

// Which combinations of party kinds a given type is meaningful for. CLIENT_PROVIDER and
// COLLABORATOR are intentionally unrestricted (either side can be a person or a
// business); ENGAGEMENT/ENDORSEMENT only make sense business-to-person; PARTNERSHIP only
// business-to-business.
const TYPE_PARTY_KIND_RULES: Record<BusinessRelationshipType, (kinds: BusinessRelationshipPartyKind[]) => boolean> = {
  ENGAGEMENT: (kinds) => kinds.includes("BUSINESS") && kinds.includes("PERSON"),
  ENDORSEMENT: (kinds) => kinds.includes("BUSINESS") && kinds.includes("PERSON"),
  PARTNERSHIP: (kinds) => kinds.every((k) => k === "BUSINESS"),
  CLIENT_PROVIDER: () => true,
  COLLABORATOR: () => true,
};

async function businessIdsActableByUser(userId: string): Promise<string[]> {
  const [owned, admin] = await Promise.all([
    prisma.business.findMany({ where: { ownerUserId: userId }, select: { id: true } }),
    prisma.businessMembership.findMany({
      where: { userId, status: "CONFIRMED", role: { in: ["OWNER", "ADMIN"] } },
      select: { businessId: true },
    }),
  ]);
  return Array.from(new Set([...owned.map((b) => b.id), ...admin.map((m) => m.businessId)]));
}

async function canActForParty(userId: string, party: BusinessRelationshipPartyInput): Promise<boolean> {
  if (party.type === "PERSON") return party.userId === userId;
  const actableIds = await businessIdsActableByUser(userId);
  return actableIds.includes(party.businessId);
}

async function assertCanActForParty(userId: string, party: BusinessRelationshipPartyInput, verb: string) {
  if (!(await canActForParty(userId, party))) {
    throw new BusinessRelationshipAuthError(
      party.type === "PERSON"
        ? `Only that person can ${verb} on their own behalf`
        : `Only the business's owner or a confirmed admin can ${verb} on its behalf`,
    );
  }
}

function partyInputFromRow(
  type: BusinessRelationshipPartyKind,
  userId: string | null,
  businessId: string | null,
): BusinessRelationshipPartyInput {
  return type === "PERSON" ? { type: "PERSON", userId: userId! } : { type: "BUSINESS", businessId: businessId! };
}

export async function createBusinessRelationship(input: {
  declaredByUserId: string;
  declaredForSide: PartySide;
  type: BusinessRelationshipType;
  partyA: BusinessRelationshipPartyInput;
  partyARole: string;
  partyB: BusinessRelationshipPartyInput;
  partyBRole: string;
}) {
  if (input.partyA.type === "PERSON" && input.partyB.type === "PERSON") {
    throw new BusinessRelationshipStateError(
      "At least one side must be a business — use the person-to-person relationship flow for two people",
    );
  }
  if (!TYPE_PARTY_KIND_RULES[input.type]([input.partyA.type, input.partyB.type])) {
    throw new BusinessRelationshipStateError(`${input.type} is not valid for this combination of party kinds`);
  }

  const declaredParty = input.declaredForSide === "A" ? input.partyA : input.partyB;
  await assertCanActForParty(input.declaredByUserId, declaredParty, "declare this relationship");

  return prisma.$transaction(async (tx) => {
    const created = await tx.businessRelationship.create({
      data: {
        type: input.type,
        partyAType: input.partyA.type,
        partyAUserId: input.partyA.type === "PERSON" ? input.partyA.userId : null,
        partyABusinessId: input.partyA.type === "BUSINESS" ? input.partyA.businessId : null,
        partyARole: input.partyARole,
        partyBType: input.partyB.type,
        partyBUserId: input.partyB.type === "PERSON" ? input.partyB.userId : null,
        partyBBusinessId: input.partyB.type === "BUSINESS" ? input.partyB.businessId : null,
        partyBRole: input.partyBRole,
        state: "PROPOSED",
        confirmationStatus: "SELF_DECLARED",
        declaredByUserId: input.declaredByUserId,
      },
    });
    await tx.businessRelationshipParticipantVisibility.createMany({
      data: [
        { businessRelationshipId: created.id, side: "A", visibility: "PUBLIC", updatedByUserId: input.declaredByUserId },
        { businessRelationshipId: created.id, side: "B", visibility: "PUBLIC", updatedByUserId: input.declaredByUserId },
      ],
    });
    return created;
  });
}

/**
 * Mirrors confirmRelationship's single most load-bearing rule: the declarer can never
 * be the one who confirms. The confirmer must be authorized to act for a party on this
 * relationship (either side — not necessarily "the other" side specifically, since a
 * business can have multiple authorized admins), but never the declaring user.
 */
export async function confirmBusinessRelationship(businessRelationshipId: string, confirmingUserId: string) {
  const rel = await prisma.businessRelationship.findUniqueOrThrow({ where: { id: businessRelationshipId } });
  if (rel.declaredByUserId === confirmingUserId) {
    throw new BusinessRelationshipAuthError("The declaring party cannot confirm their own declaration");
  }

  const partyA = partyInputFromRow(rel.partyAType, rel.partyAUserId, rel.partyABusinessId);
  const partyB = partyInputFromRow(rel.partyBType, rel.partyBUserId, rel.partyBBusinessId);
  const [canActA, canActB] = await Promise.all([
    canActForParty(confirmingUserId, partyA),
    canActForParty(confirmingUserId, partyB),
  ]);
  if (!canActA && !canActB) {
    throw new BusinessRelationshipAuthError("Only someone authorized to act for a party on this relationship can confirm it");
  }
  if (rel.confirmationStatus === "MUTUALLY_CONFIRMED") return rel;

  const updated = await prisma.businessRelationship.update({
    where: { id: businessRelationshipId },
    data: { confirmationStatus: "MUTUALLY_CONFIRMED", state: rel.state === "PROPOSED" ? "ACTIVE" : rel.state },
  });
  await logAudit({
    actorUserId: confirmingUserId,
    action: "business_relationship.confirm",
    targetType: "BusinessRelationship",
    targetId: businessRelationshipId,
  });
  return updated;
}

/** Only ever updates the acting side's own visibility row — never the other side's. */
export async function setBusinessRelationshipVisibility(
  businessRelationshipId: string,
  side: PartySide,
  actingUserId: string,
  visibility: Visibility,
  hidden: boolean,
) {
  const rel = await prisma.businessRelationship.findUniqueOrThrow({ where: { id: businessRelationshipId } });
  const party =
    side === "A"
      ? partyInputFromRow(rel.partyAType, rel.partyAUserId, rel.partyABusinessId)
      : partyInputFromRow(rel.partyBType, rel.partyBUserId, rel.partyBBusinessId);
  await assertCanActForParty(actingUserId, party, "change visibility");

  return prisma.businessRelationshipParticipantVisibility.update({
    where: { businessRelationshipId_side: { businessRelationshipId, side } },
    data: { visibility, hidden, updatedByUserId: actingUserId },
  });
}

export async function addBusinessRelationshipEvidence(input: {
  businessRelationshipId: string;
  description: string;
  portfolioItemId?: string;
  url?: string;
  addedByUserId: string;
}) {
  const rel = await prisma.businessRelationship.findUniqueOrThrow({ where: { id: input.businessRelationshipId } });
  const partyA = partyInputFromRow(rel.partyAType, rel.partyAUserId, rel.partyABusinessId);
  const partyB = partyInputFromRow(rel.partyBType, rel.partyBUserId, rel.partyBBusinessId);
  const [canActA, canActB] = await Promise.all([
    canActForParty(input.addedByUserId, partyA),
    canActForParty(input.addedByUserId, partyB),
  ]);
  if (!canActA && !canActB) {
    throw new BusinessRelationshipAuthError("Only someone authorized to act for a party on this relationship can add evidence");
  }
  return prisma.businessRelationshipEvidence.create({ data: input });
}

export async function raiseBusinessRelationshipDispute(businessRelationshipId: string, raisedByUserId: string, reason: string) {
  const rel = await prisma.businessRelationship.findUniqueOrThrow({ where: { id: businessRelationshipId } });
  const partyA = partyInputFromRow(rel.partyAType, rel.partyAUserId, rel.partyABusinessId);
  const partyB = partyInputFromRow(rel.partyBType, rel.partyBUserId, rel.partyBBusinessId);
  const [canActA, canActB] = await Promise.all([
    canActForParty(raisedByUserId, partyA),
    canActForParty(raisedByUserId, partyB),
  ]);
  if (!canActA && !canActB) {
    throw new BusinessRelationshipAuthError("Only someone authorized to act for a party on this relationship can dispute it");
  }
  const dispute = await prisma.businessRelationshipDispute.create({
    data: { businessRelationshipId, raisedByUserId, reason },
  });
  await logAudit({
    actorUserId: raisedByUserId,
    action: "business_relationship.dispute.raise",
    targetType: "BusinessRelationship",
    targetId: businessRelationshipId,
    metadata: { reason },
  });
  return dispute;
}

export async function listMyBusinessRelationships(userId: string) {
  const businessIds = await businessIdsActableByUser(userId);
  return prisma.businessRelationship.findMany({
    where: {
      OR: [
        { partyAUserId: userId },
        { partyBUserId: userId },
        ...(businessIds.length > 0
          ? [{ partyABusinessId: { in: businessIds } }, { partyBBusinessId: { in: businessIds } }]
          : []),
      ],
    },
    include: {
      partyAUser: { select: { id: true, name: true } },
      partyABusiness: { select: { id: true, name: true, slug: true } },
      partyBUser: { select: { id: true, name: true } },
      partyBBusiness: { select: { id: true, name: true, slug: true } },
      visibilities: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBusinessRelationshipDetail(businessRelationshipId: string, viewerUserId: string) {
  const rel = await prisma.businessRelationship.findUnique({
    where: { id: businessRelationshipId },
    include: {
      partyAUser: { select: { id: true, name: true } },
      partyABusiness: { select: { id: true, name: true, slug: true } },
      partyBUser: { select: { id: true, name: true } },
      partyBBusiness: { select: { id: true, name: true, slug: true } },
      visibilities: true,
      evidence: { orderBy: { createdAt: "desc" } },
      disputes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!rel) return null;
  const partyA = partyInputFromRow(rel.partyAType, rel.partyAUserId, rel.partyABusinessId);
  const partyB = partyInputFromRow(rel.partyBType, rel.partyBUserId, rel.partyBBusinessId);
  const [canActA, canActB] = await Promise.all([canActForParty(viewerUserId, partyA), canActForParty(viewerUserId, partyB)]);
  if (!canActA && !canActB) {
    throw new BusinessRelationshipAuthError("Not authorized to view this relationship");
  }
  return rel;
}
