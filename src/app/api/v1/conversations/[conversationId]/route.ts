import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { getConversationForUser } from "@/lib/services/message-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  let ctx;
  try {
    ctx = await requireApiUser(request, "messages:read");
  } catch (err) {
    return apiErrorResponse(err);
  }

  const { conversationId } = await params;
  try {
    const conversation = await getConversationForUser(conversationId, ctx.userId);
    return apiJson({ conversation });
  } catch {
    // Not found, or caller isn't a participant — same as the legacy route, don't
    // distinguish the two (that itself would leak which conversation IDs exist).
    return apiJson({ error: "Not found" }, { status: 404 });
  }
}
