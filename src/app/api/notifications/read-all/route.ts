import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { markAllRead } from "@/lib/services/notification-service";

export async function POST() {
  const user = await requireUser();
  await markAllRead(user.id);
  return NextResponse.json({ ok: true });
}
