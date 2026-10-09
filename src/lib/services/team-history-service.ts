import { prisma } from "@/lib/prisma";
import { RelationshipAuthError, RelationshipStateError, isVisibleToViewer } from "@/lib/services/relationship-service";

/**
 * Project-based collaboration history (Track 3 — relationships & collaboration graph,
 * see docs/roadmap/03-relationships-and-collaboration.md). Anchors an existing
 * person-to-person Relationship to a specific PortfolioItem so "worked-with" becomes
 * "worked with on *this*", and makes "who worked together, on what, when" queryable per
 * project — this is the construct Opportunity network (Track 4) and Learning &
 * mentorship (Track 5) are expected to read from.
 *
 * Anchoring is additive metadata on an already-confirmed-or-self-declared Relationship,
 * not a new trust claim of its own — it doesn't move confirmationStatus.
 */

/**
 * Anchor (or re-anchor, idempotently) a relationship to a project. The acting user must
 * be a party to the relationship, and the project must belong to one of the two parties
 * (as the owning person, or as the business's owner/confirmed member) — otherwise
 * anchoring an unrelated project would let anyone fabricate a team-history entry.
 */
export async function anchorRelationshipToProject(input: {
  relationshipId: string;
  portfolioItemId: string;
  addedByUserId: string;
  note?: string;
}) {
  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: input.relationshipId } });
  if (rel.partyAUserId !== input.addedByUserId && rel.partyBUserId !== input.addedByUserId) {
    throw new RelationshipAuthError("Only a party to this relationship can anchor it to a project");
  }

  const project = await prisma.portfolioItem.findUniqueOrThrow({
    where: { id: input.portfolioItemId },
    include: {
      personProfile: { select: { userId: true } },
      business: {
        select: {
          ownerUserId: true,
          memberships: { where: { status: "CONFIRMED" }, select: { userId: true } },
        },
      },
    },
  });

  const projectUserIds = new Set<string>();
  if (project.personProfile) projectUserIds.add(project.personProfile.userId);
  if (project.business) {
    projectUserIds.add(project.business.ownerUserId);
    for (const m of project.business.memberships) projectUserIds.add(m.userId);
  }
  const involvesAParty = projectUserIds.has(rel.partyAUserId) || projectUserIds.has(rel.partyBUserId);
  if (!involvesAParty) {
    throw new RelationshipStateError("The project must belong to one of the relationship's parties");
  }

  return prisma.relationshipProjectLink.upsert({
    where: {
      relationshipId_portfolioItemId: { relationshipId: input.relationshipId, portfolioItemId: input.portfolioItemId },
    },
    create: {
      relationshipId: input.relationshipId,
      portfolioItemId: input.portfolioItemId,
      addedByUserId: input.addedByUserId,
      note: input.note,
    },
    update: { note: input.note },
  });
}

/** Either party to the relationship may remove the anchor — it's shared metadata, not a one-sided claim. */
export async function removeProjectAnchor(relationshipId: string, portfolioItemId: string, removingUserId: string) {
  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: relationshipId } });
  if (rel.partyAUserId !== removingUserId && rel.partyBUserId !== removingUserId) {
    throw new RelationshipAuthError("Only a party to this relationship can remove its project anchor");
  }
  await prisma.relationshipProjectLink.deleteMany({ where: { relationshipId, portfolioItemId } });
}

export async function listProjectsForRelationship(relationshipId: string) {
  return prisma.relationshipProjectLink.findMany({
    where: { relationshipId },
    include: { portfolioItem: { select: { id: true, title: true, images: true, dateOccurred: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Raw team-history query for a project: every relationship anchored to it, regardless
 * of visibility. Intended for internal/cross-track consumption (e.g. a future
 * Opportunity/Learning track reading team composition) — callers rendering this to an
 * arbitrary viewer should use `listVisibleTeamHistoryForProject` instead.
 */
export async function listTeamHistoryForProject(portfolioItemId: string) {
  return prisma.relationshipProjectLink.findMany({
    where: { portfolioItemId },
    include: {
      relationship: {
        include: {
          partyA: { select: { id: true, name: true } },
          partyB: { select: { id: true, name: true } },
          visibilities: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Same as listTeamHistoryForProject, filtered to what viewerUserId is actually allowed
 * to see: the viewer always sees entries where they're a party; otherwise an entry only
 * shows if BOTH parties' own visibility settings permit it (mirrors the conservative
 * "most restrictive side wins" reading of per-participant visibility — neither party's
 * hide should be bypassable by the other party's project-tagging).
 */
export async function listVisibleTeamHistoryForProject(portfolioItemId: string, viewerUserId: string | null) {
  const links = await listTeamHistoryForProject(portfolioItemId);
  return links.filter((link) => {
    const rel = link.relationship;
    if (viewerUserId && (viewerUserId === rel.partyAUserId || viewerUserId === rel.partyBUserId)) return true;
    const visA = rel.visibilities.find((v) => v.userId === rel.partyAUserId);
    const visB = rel.visibilities.find((v) => v.userId === rel.partyBUserId);
    return isVisibleToViewer(visA, viewerUserId) && isVisibleToViewer(visB, viewerUserId);
  });
}
