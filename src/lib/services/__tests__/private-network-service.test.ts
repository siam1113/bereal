import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { respondToRelationshipRequest } from "@/lib/services/relationship-service";
import {
  PrivateNetworkAuthError,
  canViewWithNetworkScope,
  createPrivateNetwork,
  inviteToPrivateNetwork,
  linkRelationshipToNetwork,
  removeFromPrivateNetwork,
  respondToPrivateNetworkInvite,
} from "@/lib/services/private-network-service";

/**
 * Covers Track 3's optional private networks (see
 * docs/roadmap/03-relationships-and-collaboration.md): network scoping must only
 * NARROW who can see a relationship, never widen past what each participant's own
 * RelationshipParticipantVisibility already allows.
 */

const RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(label: string) {
  return prisma.user.create({
    data: { email: `${label}.${RUN_ID}@test.invalid`, name: `${label} ${RUN_ID}`, status: "ACTIVE" },
  });
}

describe("private-network-service", () => {
  let creator: { id: string };
  let member: { id: string };
  let nonMember: { id: string };
  let counterpart: { id: string };
  let networkId: string;
  let relationshipId: string;

  beforeAll(async () => {
    creator = await makeUser("pn-creator");
    member = await makeUser("pn-member");
    nonMember = await makeUser("pn-nonmember");
    counterpart = await makeUser("pn-counterpart");

    const network = await createPrivateNetwork({ createdByUserId: creator.id, name: `Guild ${RUN_ID}` });
    networkId = network.id;
    await inviteToPrivateNetwork(networkId, creator.id, member.id);
    await respondToPrivateNetworkInvite(networkId, member.id, true);

    const request = await prisma.relationshipRequest.create({
      data: { fromUserId: creator.id, toUserId: counterpart.id, proposedType: "COLLABORATOR", intent: "WANT_TO_COLLABORATE" },
    });
    const { relationship } = await respondToRelationshipRequest(request.id, counterpart.id, true);
    relationshipId = relationship!.id;
  });

  afterAll(async () => {
    // PrivateNetwork.createdByUserId has no onDelete: Cascade — delete the network
    // first (cascades its memberships and relationship-network links), then users
    // (cascades their Relationship rows, same as relationship-service.test.ts).
    await prisma.privateNetwork.deleteMany({ where: { id: networkId } });
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
  });

  it("makes the creator an active admin member automatically", async () => {
    const membership = await prisma.privateNetworkMembership.findUniqueOrThrow({
      where: { networkId_userId: { networkId, userId: creator.id } },
    });
    expect(membership.role).toBe("ADMIN");
    expect(membership.status).toBe("ACTIVE");
  });

  it("refuses to let a non-admin, non-self removal happen", async () => {
    await expect(removeFromPrivateNetwork(networkId, member.id, creator.id)).rejects.toBeInstanceOf(
      PrivateNetworkAuthError,
    );
  });

  it("refuses to link a relationship into a network the acting user isn't a member of", async () => {
    await expect(linkRelationshipToNetwork(relationshipId, networkId, nonMember.id)).rejects.toBeInstanceOf(
      PrivateNetworkAuthError,
    );
  });

  it("refuses to link a relationship the acting user isn't a party to", async () => {
    // member is a network member but not a party to this relationship.
    await expect(linkRelationshipToNetwork(relationshipId, networkId, member.id)).rejects.toBeInstanceOf(
      PrivateNetworkAuthError,
    );
  });

  it("narrows visibility to network members once a relationship is linked, without widening past participant visibility", async () => {
    const rel = { id: relationshipId, partyAUserId: creator.id, partyBUserId: counterpart.id };

    // Before any network link: ordinary PUBLIC visibility governs.
    expect(await canViewWithNetworkScope(rel, creator.id, nonMember.id)).toBe(true);

    await linkRelationshipToNetwork(relationshipId, networkId, creator.id);

    // After linking: a network member can see it, a non-member stranger cannot.
    expect(await canViewWithNetworkScope(rel, creator.id, member.id)).toBe(true);
    expect(await canViewWithNetworkScope(rel, creator.id, nonMember.id)).toBe(false);

    // The two parties can always see their own relationship regardless of network scoping.
    expect(await canViewWithNetworkScope(rel, creator.id, counterpart.id)).toBe(true);

    // If the profile owner hides their side entirely, network membership never overrides that.
    await prisma.relationshipParticipantVisibility.update({
      where: { relationshipId_userId: { relationshipId, userId: creator.id } },
      data: { hidden: true },
    });
    expect(await canViewWithNetworkScope(rel, creator.id, member.id)).toBe(false);
  });
});
