import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { slugify } from "@/lib/slug";
import type { SkillCategoryGroup } from "@prisma/client";

export async function searchSkills(query: string, limit = 20) {
  const q = query.trim();
  if (!q) {
    return prisma.skill.findMany({
      where: { isApproved: true },
      orderBy: { name: "asc" },
      take: limit,
    });
  }

  return prisma.skill.findMany({
    where: {
      isApproved: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { aliases: { some: { alias: { contains: q, mode: "insensitive" } } } },
      ],
    },
    orderBy: { name: "asc" },
    take: limit,
  });
}

export async function getSkillById(id: string) {
  return prisma.skill.findUnique({ where: { id } });
}

/**
 * Free-text skill suggestion queue (plan section 4.A: "avoid restricting users to formal
 * occupations"). Creates an unapproved Skill row awaiting admin review — never auto-approved.
 */
export async function suggestSkill(name: string, categoryGroup: SkillCategoryGroup = "OTHER") {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Skill name is required");

  const slug = slugify(trimmed);
  const existing = await prisma.skill.findUnique({ where: { slug } });
  if (existing) return existing;

  return prisma.skill.create({
    data: {
      slug,
      name: trimmed,
      categoryGroup,
      isApproved: false,
      suggestedById: user.id,
    },
  });
}
