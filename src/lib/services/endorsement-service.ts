import { prisma } from "@/lib/prisma";
import { RelationshipAuthError } from "@/lib/services/relationship-service";
import type { EndorsementStatus } from "@prisma/client";

export async function createEndorsement(input: {
  endorserUserId: string;
  subjectUserId: string;
  skillId: string;
  relationshipId: string;
  comment?: string;
}) {
  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: input.relationshipId } });
  const involvesBoth =
    (rel.partyAUserId === input.endorserUserId && rel.partyBUserId === input.subjectUserId) ||
    (rel.partyBUserId === input.endorserUserId && rel.partyAUserId === input.subjectUserId);
  if (!involvesBoth) {
    throw new RelationshipAuthError("Endorsement must be backed by a relationship between endorser and subject");
  }

  // Recomputed server-side, every time — never trust client-supplied status.
  const status: EndorsementStatus =
    rel.confirmationStatus === "MUTUALLY_CONFIRMED" || rel.confirmationStatus === "EVIDENCE_REVIEWED"
      ? "VERIFIED"
      : "UNVERIFIED";

  return prisma.endorsement.create({
    data: {
      endorserUserId: input.endorserUserId,
      subjectUserId: input.subjectUserId,
      skillId: input.skillId,
      relationshipId: input.relationshipId,
      status,
      comment: input.comment,
    },
  });
}

export async function listEndorsementsReceived(subjectUserId: string) {
  return prisma.endorsement.findMany({
    where: { subjectUserId },
    include: { endorser: { select: { id: true, name: true } }, skill: true },
    orderBy: { createdAt: "desc" },
  });
}
