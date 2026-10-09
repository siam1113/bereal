import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function listPendingSkills() {
  return prisma.skill.findMany({
    where: { isApproved: false },
    include: { suggestedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listApprovedSkills() {
  return prisma.skill.findMany({
    where: { isApproved: true },
    orderBy: { name: "asc" },
  });
}

export async function approveSkill(skillId: string, adminUserId: string) {
  const skill = await prisma.skill.update({ where: { id: skillId }, data: { isApproved: true } });
  await logAudit({
    actorUserId: adminUserId,
    action: "SKILL_APPROVED",
    targetType: "Skill",
    targetId: skillId,
  });
  return skill;
}

export async function rejectSkill(skillId: string, adminUserId: string) {
  await prisma.skill.delete({ where: { id: skillId } });
  await logAudit({
    actorUserId: adminUserId,
    action: "SKILL_REJECTED",
    targetType: "Skill",
    targetId: skillId,
  });
}

/** Reassigns all PersonSkill/PortfolioItemSkill rows from the duplicate skill to the canonical one, then deletes the duplicate. */
export async function mergeSkill(duplicateSkillId: string, canonicalSkillId: string, adminUserId: string) {
  if (duplicateSkillId === canonicalSkillId) {
    throw new Error("Cannot merge a skill into itself");
  }

  await prisma.$transaction(async (tx) => {
    const existingPersonSkills = await tx.personSkill.findMany({
      where: { skillId: duplicateSkillId },
      select: { id: true, personProfileId: true },
    });
    const canonicalPersonProfileIds = new Set(
      (
        await tx.personSkill.findMany({
          where: { skillId: canonicalSkillId },
          select: { personProfileId: true },
        })
      ).map((r) => r.personProfileId),
    );

    for (const ps of existingPersonSkills) {
      if (canonicalPersonProfileIds.has(ps.personProfileId)) {
        // Profile already has the canonical skill — drop the duplicate row instead of
        // violating the (personProfileId, skillId) unique constraint.
        await tx.personSkill.delete({ where: { id: ps.id } });
      } else {
        await tx.personSkill.update({ where: { id: ps.id }, data: { skillId: canonicalSkillId } });
      }
    }

    const existingPortfolioLinks = await tx.portfolioItemSkill.findMany({
      where: { skillId: duplicateSkillId },
    });
    for (const link of existingPortfolioLinks) {
      const alreadyLinked = await tx.portfolioItemSkill.findUnique({
        where: {
          portfolioItemId_skillId: { portfolioItemId: link.portfolioItemId, skillId: canonicalSkillId },
        },
      });
      if (alreadyLinked) {
        await tx.portfolioItemSkill.delete({
          where: {
            portfolioItemId_skillId: { portfolioItemId: link.portfolioItemId, skillId: duplicateSkillId },
          },
        });
      } else {
        await tx.portfolioItemSkill.update({
          where: {
            portfolioItemId_skillId: { portfolioItemId: link.portfolioItemId, skillId: duplicateSkillId },
          },
          data: { skillId: canonicalSkillId },
        });
      }
    }

    await tx.skill.delete({ where: { id: duplicateSkillId } });
  });

  await logAudit({
    actorUserId: adminUserId,
    action: "SKILL_MERGED",
    targetType: "Skill",
    targetId: canonicalSkillId,
    metadata: { mergedFrom: duplicateSkillId },
  });
}
