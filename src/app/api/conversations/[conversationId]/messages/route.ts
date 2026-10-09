import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { sendMessage } from "@/lib/services/message-service";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ content: z.string().min(1).max(4000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const user = await requireUser();
  if (!rateLimit(`message:${user.id}`, 30, 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many messages, slow down" }, { status: 429 });
  }

  const { conversationId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const message = await sendMessage({ conversationId, senderUserId: user.id, content: parsed.data.content });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
}
