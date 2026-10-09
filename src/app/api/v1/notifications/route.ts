import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { listNotifications, unreadCount } from "@/lib/services/notification-service";

export async function GET(request: Request) {
  try {
    const ctx = await requireApiUser(request, "notifications:read");
    const [notifications, unread] = await Promise.all([
      listNotifications(ctx.userId),
      unreadCount(ctx.userId),
    ]);
    return apiJson({ notifications, unread });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
