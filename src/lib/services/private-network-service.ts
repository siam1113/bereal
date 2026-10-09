import { prisma } from "@/lib/prisma";
import { isVisibleToViewer } from "@/lib/services/relationship-service";
import type { PrivateNetworkMembershipRole } from "@prisma/client";

/**
 * Optional private networks (Track 3 — relationships & collaboration graph, see
 * docs/roadmap/03-relationships-and-collaboration.md): a closed group whose members can
 * see relationships tagged into it even when a stranger couldn't. This layers ON TOP OF
 * — never replaces — RelationshipParticipantVisibility: a relationship either party has
 * hidden stays hidden from everyone, network membership or not (see
 * canViewWithNetworkScope).
 *
 * Flagged policy questions (see docs/decisions.md — not resolved here, deliberately
 * conservative defaults chosen instead):
 * - What counts as "sensitive" for the explicit-consent requirement beyond FAMILY.
 *   Private networks don't introduce a new consent gate; membership itself is just
 *   invite/accept, same bar as following someone.
 * - Default visibility of network membership itself: `PrivateNetwork.membershipVisible`
 *   defaults to false (members-only) — see createPrivateNetwork.
 */

export class PrivateNetworkAuthError extends Error {}
export class PrivateNetworkStateError extends Error {}

async function assertNetworkAdmin(networkId: string, userId: string) {
  const network = await prisma.privateNetwork.findUniqueOrThrow({ where: { id: networkId } });
  if (network.createdByUserId === userId) return;
  const membership = await prisma.privateNetworkMembership.findUnique({
    where: { networkId_userId: { networkId, userId } },
  });
  if (!membership || membership.status !== "ACTIVE" || membership.role !== "ADMIN") {
    throw new PrivateNetworkAuthError("Only a network admin can do this");
  }
}

async function isActiveMember(networkId: string, userId: string): Promise<boolean> {
  const membership = await prisma.privateNetworkMembership.findUnique({
    where: { networkId_userId: { networkId, userId } },
  });
  return !!membership && membership.status === "ACTIVE";
}

/** Creator becomes the first ACTIVE ADMIN member. `membershipVisible` defaults to false — see module doc. */
export async function createPrivateNetwork(input: {
  createdByUserId: string;
  name: string;
  description?: string;
  membershipVisible?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const network = await tx.privateNetwork.create({
      data: {
        name: input.name,
        description: input.description,
        createdByUserId: input.createdByUserId,
        membershipVisible: input.membershipVisible ?? false,
      },
    });
    await tx.privateNetworkMembership.create({
      data: {
        networkId: network.id,
        userId: input.createdByUserId,
        role: "ADMIN",
        status: "ACTIVE",
        invitedByUserId: input.createdByUserId,
        joinedAt: new Date(),
      },
    });
    return network;
  });
}

export async function inviteToPrivateNetwork(
  networkId: string,
  invitedByUserId: string,
  userId: string,
  role: PrivateNetworkMembershipRole = "MEMBER",
) {
  await assertNetworkAdmin(networkId, invitedByUserId);
  if (userId === invitedByUserId) throw new PrivateNetworkStateError("Cannot invite yourself");
  return prisma.privateNetworkMembership.upsert({
    where: { networkId_userId: { networkId, userId } },
    create: { networkId, userId, role, status: "INVITED", invitedByUserId },
    update: { status: "INVITED", role, invitedByUserId },
  });
}

/** Only the invited user may accept/decline their own invite. */
export async function respondToPrivateNetworkInvite(networkId: string, userId: string, accept: boolean) {
  const membership = await prisma.privateNetworkMembership.findUniqueOrThrow({
    where: { networkId_userId: { networkId, userId } },
  });
  if (membership.status !== "INVITED") throw new PrivateNetworkStateError("No pending invite for this network");
  return prisma.privateNetworkMembership.update({
    where: { networkId_userId: { networkId, userId } },
    data: accept ? { status: "ACTIVE", joinedAt: new Date() } : { status: "DECLINED" },
  });
}

/** A member may remove themselves (leave); otherwise the acting user must be a network admin. */
export async function removeFromPrivateNetwork(networkId: string, actingUserId: string, targetUserId: string) {
  if (actingUserId !== targetUserId) {
    await assertNetworkAdmin(networkId, actingUserId);
  }
  return prisma.privateNetworkMembership.update({
    where: { networkId_userId: { networkId, userId: targetUserId } },
    data: { status: "REMOVED" },
  });
}

export async function listMyPrivateNetworks(userId: string) {
  return prisma.privateNetworkMembership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { network: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listNetworkMembers(networkId: string, viewerUserId: string) {
  const network = await prisma.privateNetwork.findUniqueOrThrow({ where: { id: networkId } });
  const viewerIsMember = await isActiveMember(networkId, viewerUserId);
  if (!viewerIsMember && !network.membershipVisible) {
    throw new PrivateNetworkAuthError("This network's membership is not visible to non-members");
  }
  return prisma.privateNetworkMembership.findMany({
    where: { networkId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });
}

/**
 * Tags a Relationship as scoped to a private network. The acting user must be both a
 * party to the relationship AND an active member of the network — otherwise someone
 * could leak a relationship into a network they don't belong to, or tag someone else's
 * relationship without consent.
 */
export async function linkRelationshipToNetwork(relationshipId: string, networkId: string, addedByUserId: string) {
  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: relationshipId } });
  if (rel.partyAUserId !== addedByUserId && rel.partyBUserId !== addedByUserId) {
    throw new PrivateNetworkAuthError("Only a party to the relationship can scope it to a network");
  }
  if (!(await isActiveMember(networkId, addedByUserId))) {
    throw new PrivateNetworkAuthError("You must be an active member of the network to use it");
  }
  return prisma.relationshipNetworkLink.upsert({
    where: { relationshipId_networkId: { relationshipId, networkId } },
    create: { relationshipId, networkId, addedByUserId },
    update: {},
  });
}

export async function unlinkRelationshipFromNetwork(relationshipId: string, networkId: string, removingUserId: string) {
  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: relationshipId } });
  if (rel.partyAUserId !== removingUserId && rel.partyBUserId !== removingUserId) {
    throw new PrivateNetworkAuthError("Only a party to the relationship can remove its network scope");
  }
  await prisma.relationshipNetworkLink.deleteMany({ where: { relationshipId, networkId } });
}

/**
 * Whether viewerUserId may see profileUserId's side of this relationship, once
 * private-network scoping is taken into account. Narrows, never widens: ordinary
 * per-participant visibility (isVisibleToViewer) must already pass; network membership
 * is then an *additional* restriction applied only when the relationship has at least
 * one network link, never a way to see something a participant has hidden.
 */
export async function canViewWithNetworkScope(
  relationship: { id: string; partyAUserId: string; partyBUserId: string },
  profileUserId: string,
  viewerUserId: string | null,
): Promise<boolean> {
  if (viewerUserId && (viewerUserId === relationship.partyAUserId || viewerUserId === relationship.partyBUserId)) {
    return true;
  }

  const visibility = await prisma.relationshipParticipantVisibility.findUnique({
    where: { relationshipId_userId: { relationshipId: relationship.id, userId: profileUserId } },
  });
  if (!isVisibleToViewer(visibility, viewerUserId)) return false;

  const networkLinks = await prisma.relationshipNetworkLink.findMany({ where: { relationshipId: relationship.id } });
  if (networkLinks.length === 0) return true; // not network-scoped — ordinary visibility already governs

  if (!viewerUserId) return false;
  for (const link of networkLinks) {
    if (await isActiveMember(link.networkId, viewerUserId)) return true;
  }
  return false;
}
