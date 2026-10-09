import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/services/notification-service";
import { isBlocked } from "@/lib/services/block-service";

const PARTICIPANT_SELECT = {
  id: true,
  name: true,
  image: true,
  personProfile: { select: { slug: true, displayName: true } },
} as const;

export async function findOrCreateConversation(userIdA: string, userIdB: string): Promise<string> {
  if (userIdA === userIdB) throw new Error("Cannot message yourself");
  if (await isBlocked(userIdA, userIdB)) throw new Error("Messaging is not available between these users");

  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: userIdA } } },
        { participants: { some: { userId: userIdB } } },
      ],
    },
    select: { id: true, participants: { select: { userId: true } } },
  });
  const exact = existing?.participants.length === 2 ? existing : null;
  if (exact) return exact.id;

  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: userIdA }, { userId: userIdB }],
      },
    },
  });
  return conversation.id;
}

export async function listConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: { include: { user: { select: PARTICIPANT_SELECT } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return conversations.map((c) => ({
    id: c.id,
    updatedAt: c.updatedAt,
    otherParticipants: c.participants.filter((p) => p.userId !== userId).map((p) => p.user),
    lastMessage: c.messages[0] ?? null,
    unread:
      (c.messages[0]?.createdAt ?? null) !== null &&
      c.participants.find((p) => p.userId === userId)?.lastReadAt !== undefined &&
      (c.participants.find((p) => p.userId === userId)?.lastReadAt ?? new Date(0)) < (c.messages[0]?.createdAt ?? new Date(0)),
  }));
}

export async function getConversationForUser(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw new Error("Not a participant in this conversation");

  return prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      participants: { include: { user: { select: PARTICIPANT_SELECT } } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: PARTICIPANT_SELECT } } },
    },
  });
}

export async function sendMessage(input: { conversationId: string; senderUserId: string; content: string }) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: input.conversationId, userId: input.senderUserId } },
  });
  if (!participant) throw new Error("Not a participant in this conversation");

  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      senderUserId: input.senderUserId,
      content: input.content,
    },
  });

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { updatedAt: new Date() },
  });

  const others = await prisma.conversationParticipant.findMany({
    where: { conversationId: input.conversationId, userId: { not: input.senderUserId } },
    select: { userId: true },
  });
  for (const { userId } of others) {
    await notify(userId, "NEW_MESSAGE", { conversationId: input.conversationId, messageId: message.id });
  }

  return message;
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });
}
