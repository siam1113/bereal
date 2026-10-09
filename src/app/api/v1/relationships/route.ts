import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { listMyRelationships } from "@/lib/services/relationship-service";

export async function GET(request: Request) {
  try {
    const ctx = await requireApiUser(request, "relationships:read");
    const relationships = await listMyRelationships(ctx.userId);
    return apiJson({ relationships });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
