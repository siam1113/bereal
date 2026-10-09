import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { getConversationForUser } from "@/lib/services/message-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const user = await requireUser();
  const { conversationId } = await params;
  try {
    const conversation = await getConversationForUser(conversationId, user.id);
    return NextResponse.json({ conversation });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
