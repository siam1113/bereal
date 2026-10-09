import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { markAllRead } from "@/lib/services/notification-service";

export async function POST(request: Request) {
  try {
    const ctx = await requireApiUser(request, "notifications:write");
    await markAllRead(ctx.userId);
    return apiJson({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
