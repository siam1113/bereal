import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { confirmRelationship } from "@/lib/services/relationship-service";

/**
 * Same invariant as the web app: `confirmRelationship` throws `RelationshipAuthError`
 * (mapped to 403 by `apiErrorResponse`) if the calling identity is the one who declared
 * the relationship — an API key can no more self-confirm than a browser session can.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiUser(request, "relationships:write");
    const { id } = await params;
    const rel = await confirmRelationship(id, ctx.userId);
    return apiJson(rel);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
