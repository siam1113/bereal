import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { sendMessage } from "@/lib/services/message-service";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ content: z.string().min(1).max(4000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  let ctx;
  try {
    ctx = await requireApiUser(request, "messages:write");
  } catch (err) {
    return apiErrorResponse(err);
  }

  if (!rateLimit(`message:${ctx.userId}`, 30, 60 * 1000).ok) {
    return apiJson({ error: "Too many messages, slow down" }, { status: 429 });
  }

  const { conversationId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiJson({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const message = await sendMessage({ conversationId, senderUserId: ctx.userId, content: parsed.data.content });
    return apiJson({ message }, { status: 201 });
  } catch (err) {
    return apiJson({ error: (err as Error).message }, { status: 403 });
  }
}
