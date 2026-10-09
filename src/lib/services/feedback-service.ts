import { prisma } from "@/lib/prisma";
import { RelationshipAuthError } from "@/lib/services/relationship-service";
import type { Prisma } from "@prisma/client";

export async function createProfessionalFeedback(input: {
  authorUserId: string;
  subjectUserId: string;
  relationshipId: string;
  attributes: Prisma.InputJsonValue;
  comment?: string;
}) {
  const rel = await prisma.relationship.findUniqueOrThrow({ where: { id: input.relationshipId } });
  const involvesBoth =
    (rel.partyAUserId === input.authorUserId && rel.partyBUserId === input.subjectUserId) ||
    (rel.partyBUserId === input.authorUserId && rel.partyAUserId === input.subjectUserId);
  if (!involvesBoth) {
    throw new RelationshipAuthError("Feedback must be backed by a relationship between author and subject");
  }

  const isIndependentlyConfirmed =
    rel.confirmationStatus === "MUTUALLY_CONFIRMED" || rel.confirmationStatus === "EVIDENCE_REVIEWED";

  return prisma.professionalFeedback.create({
    data: {
      authorUserId: input.authorUserId,
      subjectUserId: input.subjectUserId,
      relationshipId: input.relationshipId,
      attributes: input.attributes,
      comment: input.comment,
      isIndependentlyConfirmed,
    },
  });
}

export async function listFeedbackReceived(subjectUserId: string) {
  return prisma.professionalFeedback.findMany({
    where: { subjectUserId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}
