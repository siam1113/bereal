import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { findOrCreateConversation, listConversations } from "@/lib/services/message-service";

const schema = z.object({ recipientUserId: z.string().min(1) });

export async function GET() {
  const user = await requireUser();
  const conversations = await listConversations(user.id);
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const conversationId = await findOrCreateConversation(user.id, parsed.data.recipientUserId);
  return NextResponse.json({ conversationId });
}
