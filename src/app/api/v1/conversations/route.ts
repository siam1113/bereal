import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { findOrCreateConversation, listConversations } from "@/lib/services/message-service";

const schema = z.object({ recipientUserId: z.string().min(1) });

export async function GET(request: Request) {
  try {
    const ctx = await requireApiUser(request, "messages:read");
    const conversations = await listConversations(ctx.userId);
    return apiJson({ conversations });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireApiUser(request, "messages:write");
  } catch (err) {
    return apiErrorResponse(err);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiJson({ error: parsed.error.flatten() }, { status: 400 });

  try {
    // findOrCreateConversation throws a plain Error for business-rule violations
    // (messaging yourself, a block in either direction) — same as the legacy route,
    // treat any failure here as 403 rather than letting it fall through to a 500.
    const conversationId = await findOrCreateConversation(ctx.userId, parsed.data.recipientUserId);
    return apiJson({ conversationId });
  } catch (err) {
    return apiJson({ error: (err as Error).message }, { status: 403 });
  }
}
