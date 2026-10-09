import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  BusinessRelationshipAuthError,
  BusinessRelationshipStateError,
  confirmBusinessRelationship,
  createBusinessRelationship,
  setBusinessRelationshipVisibility,
} from "@/lib/services/business-relationship-service";

/**
 * Covers Track 3's business-to-person / business-to-business relationships (see
 * docs/roadmap/03-relationships-and-collaboration.md): same self-declared ->
 * mutually-confirmed and per-side-visibility invariants as person-to-person
 * relationships, but "acting for a side" means being the person themselves, or the
 * business's owner/confirmed admin — never just anyone.
 */

const RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(label: string) {
  return prisma.user.create({
    data: { email: `${label}.${RUN_ID}@test.invalid`, name: `${label} ${RUN_ID}`, status: "ACTIVE" },
  });
}

describe("business-relationship-service", () => {
  let owner: { id: string };
  let admin: { id: string };
  let person: { id: string };
  let outsider: { id: string };
  let businessId: string;

  beforeAll(async () => {
    owner = await makeUser("bizrel-owner");
    admin = await makeUser("bizrel-admin");
    person = await makeUser("bizrel-person");
    outsider = await makeUser("bizrel-outsider");

    const business = await prisma.business.create({
      data: { slug: `bizrel-biz-${RUN_ID}`, name: `BizRel Co ${RUN_ID}`, ownerUserId: owner.id },
    });
    businessId = business.id;
    await prisma.businessMembership.create({
      data: { businessId, userId: admin.id, role: "ADMIN", status: "CONFIRMED" },
    });
  });

  afterAll(async () => {
    // BusinessRelationship/Business reference User with no onDelete: Cascade (same
    // convention as Business.ownerUserId in the existing schema) — delete them first.
    await prisma.businessRelationship.deleteMany({ where: { partyABusinessId: businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
  });

  it("rejects a type that requires two businesses when one side is a person", async () => {
    await expect(
      createBusinessRelationship({
        declaredByUserId: owner.id,
        declaredForSide: "A",
        type: "PARTNERSHIP",
        partyA: { type: "BUSINESS", businessId },
        partyARole: "PARTNER",
        partyB: { type: "PERSON", userId: person.id },
        partyBRole: "PARTNER",
      }),
    ).rejects.toBeInstanceOf(BusinessRelationshipStateError);
  });

  it("rejects two person sides outright — that belongs to the person-to-person flow", async () => {
    await expect(
      createBusinessRelationship({
        declaredByUserId: person.id,
        declaredForSide: "A",
        type: "COLLABORATOR",
        partyA: { type: "PERSON", userId: person.id },
        partyARole: "COLLABORATOR",
        partyB: { type: "PERSON", userId: outsider.id },
        partyBRole: "COLLABORATOR",
      }),
    ).rejects.toBeInstanceOf(BusinessRelationshipStateError);
  });

  it("refuses to let an unauthorized user declare on a business's behalf", async () => {
    await expect(
      createBusinessRelationship({
        declaredByUserId: outsider.id,
        declaredForSide: "A",
        type: "ENGAGEMENT",
        partyA: { type: "BUSINESS", businessId },
        partyARole: "ENGAGER",
        partyB: { type: "PERSON", userId: person.id },
        partyBRole: "ENGAGED",
      }),
    ).rejects.toBeInstanceOf(BusinessRelationshipAuthError);
  });

  it("lets the business owner declare an ENGAGEMENT with a person, self-declared", async () => {
    const rel = await createBusinessRelationship({
      declaredByUserId: owner.id,
      declaredForSide: "A",
      type: "ENGAGEMENT",
      partyA: { type: "BUSINESS", businessId },
      partyARole: "ENGAGER",
      partyB: { type: "PERSON", userId: person.id },
      partyBRole: "ENGAGED",
    });
    expect(rel.confirmationStatus).toBe("SELF_DECLARED");
    expect(rel.declaredByUserId).toBe(owner.id);

    // The declarer can never confirm their own declaration.
    await expect(confirmBusinessRelationship(rel.id, owner.id)).rejects.toBeInstanceOf(BusinessRelationshipAuthError);

    // Someone wholly unaffiliated with either side can't confirm it either.
    await expect(confirmBusinessRelationship(rel.id, outsider.id)).rejects.toBeInstanceOf(BusinessRelationshipAuthError);

    // The person on the other side can confirm.
    const confirmed = await confirmBusinessRelationship(rel.id, person.id);
    expect(confirmed.confirmationStatus).toBe("MUTUALLY_CONFIRMED");
  });

  it("lets a confirmed business admin act for the business side, independent of the owner", async () => {
    const rel = await createBusinessRelationship({
      declaredByUserId: admin.id,
      declaredForSide: "A",
      type: "ENDORSEMENT",
      partyA: { type: "BUSINESS", businessId },
      partyARole: "ENDORSER",
      partyB: { type: "PERSON", userId: person.id },
      partyBRole: "ENDORSED",
    });
    expect(rel.declaredByUserId).toBe(admin.id);

    // Visibility: only the acting side's row changes.
    const updated = await setBusinessRelationshipVisibility(rel.id, "B", person.id, "PRIVATE", false);
    expect(updated.visibility).toBe("PRIVATE");

    const sideAVisibility = await prisma.businessRelationshipParticipantVisibility.findUnique({
      where: { businessRelationshipId_side: { businessRelationshipId: rel.id, side: "A" } },
    });
    expect(sideAVisibility?.visibility).toBe("PUBLIC");

    // Person can't flip the business's own side's visibility.
    await expect(setBusinessRelationshipVisibility(rel.id, "A", person.id, "PRIVATE", false)).rejects.toBeInstanceOf(
      BusinessRelationshipAuthError,
    );
  });
});
