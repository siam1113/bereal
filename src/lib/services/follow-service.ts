import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/services/notification-service";

/** Following does NOT imply any relationship — this is a lightweight feed subscription only. */
export async function followUser(followerUserId: string, followeeUserId: string): Promise<void> {
  if (followerUserId === followeeUserId) throw new Error("Cannot follow yourself");
  await prisma.follow.upsert({
    where: { followerUserId_followeeUserId: { followerUserId, followeeUserId } },
    update: {},
    create: { followerUserId, followeeUserId },
  });
  await notify(followeeUserId, "NEW_FOLLOWER", { followerUserId });
}

export async function unfollowUser(followerUserId: string, followeeUserId: string): Promise<void> {
  await prisma.follow.deleteMany({ where: { followerUserId, followeeUserId } });
}

export async function isFollowing(followerUserId: string, followeeUserId: string): Promise<boolean> {
  const found = await prisma.follow.findUnique({
    where: { followerUserId_followeeUserId: { followerUserId, followeeUserId } },
  });
  return !!found;
}
