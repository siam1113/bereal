import { prisma } from "@/lib/prisma";
import type { ReactionType } from "@prisma/client";
import { notify } from "@/lib/services/notification-service";
import { getMutualBlockUserIds } from "@/lib/services/block-service";

const POST_AUTHOR_SELECT = {
  id: true,
  name: true,
  image: true,
  personProfile: { select: { slug: true, displayName: true } },
} as const;

export async function createPost(input: {
  authorUserId: string;
  content: string;
  images?: string[];
  linkedPortfolioItemId?: string;
  visibility?: "PUBLIC" | "CONNECTIONS" | "PRIVATE";
}) {
  return prisma.post.create({
    data: {
      authorUserId: input.authorUserId,
      content: input.content,
      images: input.images ?? [],
      linkedPortfolioItemId: input.linkedPortfolioItemId,
      visibility: input.visibility ?? "PUBLIC",
    },
  });
}

export async function deletePost(postId: string, requesterUserId: string): Promise<void> {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  if (post.authorUserId !== requesterUserId) throw new Error("Not your post");
  await prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
}

/**
 * V1 simplification: CONNECTIONS visibility is treated as "any signed-in user" rather than
 * joining against the relationship graph (owned by a different vertical, not safe to import
 * mid-build). PRIVATE is author-only.
 */
export async function getFeedForViewer(viewerUserId: string | null, limit = 30) {
  const blockedIds = viewerUserId ? await getMutualBlockUserIds(viewerUserId) : [];

  const followedIds = viewerUserId
    ? (
        await prisma.follow.findMany({
          where: { followerUserId: viewerUserId },
          select: { followeeUserId: true },
        })
      ).map((f) => f.followeeUserId)
    : [];

  return prisma.post.findMany({
    where: {
      deletedAt: null,
      authorUserId: blockedIds.length ? { notIn: blockedIds } : undefined,
      OR: [
        { visibility: "PUBLIC" },
        ...(followedIds.length ? [{ visibility: "CONNECTIONS" as const, authorUserId: { in: followedIds } }] : []),
        ...(viewerUserId ? [{ authorUserId: viewerUserId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      author: { select: POST_AUTHOR_SELECT },
      _count: { select: { comments: true, reactions: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        take: 3,
        include: { author: { select: POST_AUTHOR_SELECT } },
      },
    },
  });
}

export async function addComment(input: { postId: string; authorUserId: string; content: string }) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: input.postId } });
  const comment = await prisma.comment.create({
    data: { postId: input.postId, authorUserId: input.authorUserId, content: input.content },
  });

  if (post.authorUserId !== input.authorUserId) {
    await notify(post.authorUserId, "POST_COMMENT", {
      postId: post.id,
      commentId: comment.id,
      authorUserId: input.authorUserId,
    });
  }

  return comment;
}

export async function toggleReaction(input: {
  postId: string;
  userId: string;
  type?: ReactionType;
}) {
  const type = input.type ?? "LIKE";
  const existing = await prisma.reaction.findUnique({
    where: { postId_userId: { postId: input.postId, userId: input.userId } },
  });

  if (existing) {
    if (existing.type === type) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      return { reacted: false };
    }
    await prisma.reaction.update({ where: { id: existing.id }, data: { type } });
    return { reacted: true };
  }

  await prisma.reaction.create({ data: { postId: input.postId, userId: input.userId, type } });

  const post = await prisma.post.findUniqueOrThrow({ where: { id: input.postId } });
  if (post.authorUserId !== input.userId) {
    await notify(post.authorUserId, "POST_REACTION", { postId: post.id, userId: input.userId, type });
  }

  return { reacted: true };
}
