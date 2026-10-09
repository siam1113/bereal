import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { listNotifications, unreadCount } from "@/lib/services/notification-service";

export async function GET() {
  const user = await requireUser();
  const [notifications, unread] = await Promise.all([
    listNotifications(user.id),
    unreadCount(user.id),
  ]);
  return NextResponse.json({ notifications, unread });
}
