import { prisma } from "@/lib/prisma";
import type { NotificationType, Prisma } from "@prisma/client";

/** Generic notification creator — any vertical can call this for its own notification types. */
export async function notify(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

export async function listNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
