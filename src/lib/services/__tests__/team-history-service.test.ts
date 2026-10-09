import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { RelationshipAuthError, RelationshipStateError, respondToRelationshipRequest } from "@/lib/services/relationship-service";
import {
  anchorRelationshipToProject,
  listTeamHistoryForProject,
  listVisibleTeamHistoryForProject,
  removeProjectAnchor,
} from "@/lib/services/team-history-service";

/**
 * Covers Track 3's project/team-history anchoring (see
 * docs/roadmap/03-relationships-and-collaboration.md): a relationship can be anchored
 * to a project only by one of its parties, only when the project actually belongs to
 * one of them, and team-history visibility narrows to what each party's own
 * RelationshipParticipantVisibility allows — never widens it.
 */

const RUN_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(label: string) {
  return prisma.user.create({
    data: { email: `${label}.${RUN_ID}@test.invalid`, name: `${label} ${RUN_ID}`, status: "ACTIVE" },
  });
}

describe("team-history-service", () => {
  let partyA: { id: string };
  let partyB: { id: string };
  let stranger: { id: string };
  let relationshipId: string;
  let projectId: string;
  let unrelatedProjectId: string;

  beforeAll(async () => {
    partyA = await makeUser("teamhist-a");
    partyB = await makeUser("teamhist-b");
    stranger = await makeUser("teamhist-stranger");

    const request = await prisma.relationshipRequest.create({
      data: { fromUserId: partyA.id, toUserId: partyB.id, proposedType: "WORKED_WITH", intent: "WANT_TO_COLLABORATE" },
    });
    const { relationship } = await respondToRelationshipRequest(request.id, partyB.id, true);
    relationshipId = relationship!.id;

    const profileA = await prisma.personProfile.create({
      data: { userId: partyA.id, slug: `teamhist-a-${RUN_ID}`, displayName: `Team Hist A ${RUN_ID}` },
    });
    const project = await prisma.portfolioItem.create({
      data: { personProfileId: profileA.id, title: `Shared project ${RUN_ID}` },
    });
    projectId = project.id;

    const profileStranger = await prisma.personProfile.create({
      data: { userId: stranger.id, slug: `teamhist-stranger-${RUN_ID}`, displayName: `Stranger ${RUN_ID}` },
    });
    const unrelated = await prisma.portfolioItem.create({
      data: { personProfileId: profileStranger.id, title: `Unrelated project ${RUN_ID}` },
    });
    unrelatedProjectId = unrelated.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: RUN_ID } } });
  });

  it("refuses to anchor when the acting user is not a party to the relationship", async () => {
    await expect(
      anchorRelationshipToProject({ relationshipId, portfolioItemId: projectId, addedByUserId: stranger.id }),
    ).rejects.toBeInstanceOf(RelationshipAuthError);
  });

  it("refuses to anchor a project that doesn't belong to either party", async () => {
    await expect(
      anchorRelationshipToProject({ relationshipId, portfolioItemId: unrelatedProjectId, addedByUserId: partyA.id }),
    ).rejects.toBeInstanceOf(RelationshipStateError);
  });

  it("anchors the relationship to a project owned by one of the parties", async () => {
    const link = await anchorRelationshipToProject({
      relationshipId,
      portfolioItemId: projectId,
      addedByUserId: partyA.id,
      note: "led the build",
    });
    expect(link.relationshipId).toBe(relationshipId);
    expect(link.portfolioItemId).toBe(projectId);

    const history = await listTeamHistoryForProject(projectId);
    expect(history).toHaveLength(1);
    expect(history[0].relationship.id).toBe(relationshipId);
  });

  it("shows visible team history to the two parties, and to a stranger only once visibility allows it", async () => {
    const asPartyA = await listVisibleTeamHistoryForProject(projectId, partyA.id);
    expect(asPartyA).toHaveLength(1);

    const asStranger = await listVisibleTeamHistoryForProject(projectId, stranger.id);
    expect(asStranger).toHaveLength(1); // default visibility on both sides is PUBLIC

    await prisma.relationshipParticipantVisibility.update({
      where: { relationshipId_userId: { relationshipId, userId: partyB.id } },
      data: { visibility: "PRIVATE" },
    });

    const asStrangerAfterHide = await listVisibleTeamHistoryForProject(projectId, stranger.id);
    expect(asStrangerAfterHide).toHaveLength(0); // one side hid it — narrows for everyone but the parties

    const asPartyAAfterHide = await listVisibleTeamHistoryForProject(projectId, partyA.id);
    expect(asPartyAAfterHide).toHaveLength(1); // a party always sees their own relationship
  });

  it("lets either party remove the anchor", async () => {
    await removeProjectAnchor(relationshipId, projectId, partyB.id);
    const history = await listTeamHistoryForProject(projectId);
    expect(history).toHaveLength(0);
  });
});
