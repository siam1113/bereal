import { prisma } from "@/lib/prisma";

export async function blockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  if (blockerUserId === blockedUserId) throw new Error("Cannot block yourself");
  await prisma.block.upsert({
    where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } },
    update: {},
    create: { blockerUserId, blockedUserId },
  });
}

export async function unblockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  await prisma.block.deleteMany({ where: { blockerUserId, blockedUserId } });
}

/** IDs the viewer has blocked, or that have blocked the viewer — hide both directions. */
export async function getMutualBlockUserIds(userId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] },
    select: { blockerUserId: true, blockedUserId: true },
  });
  const ids = new Set<string>();
  for (const b of blocks) {
    ids.add(b.blockerUserId === userId ? b.blockedUserId : b.blockerUserId);
  }
  return [...ids];
}

export async function isBlocked(userIdA: string, userIdB: string): Promise<boolean> {
  const found = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerUserId: userIdA, blockedUserId: userIdB },
        { blockerUserId: userIdB, blockedUserId: userIdA },
      ],
    },
    select: { id: true },
  });
  return !!found;
}
