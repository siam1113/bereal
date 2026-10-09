import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { markRead } from "@/lib/services/notification-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const user = await requireUser();
  const { notificationId } = await params;
  await markRead(user.id, notificationId);
  return NextResponse.json({ ok: true });
}
