import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { markConversationRead } from "@/lib/services/message-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const user = await requireUser();
  const { conversationId } = await params;
  await markConversationRead(conversationId, user.id);
  return NextResponse.json({ ok: true });
}
