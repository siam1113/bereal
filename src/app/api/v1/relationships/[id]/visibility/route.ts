import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { setParticipantVisibility } from "@/lib/services/relationship-service";

const schema = z.object({
  visibility: z.enum(["PUBLIC", "CONNECTIONS", "PRIVATE"]),
  hidden: z.boolean(),
});

/**
 * `setParticipantVisibility` only ever touches the caller's own
 * `RelationshipParticipantVisibility` row — identical invariant whether the caller
 * authenticated via session or API key, enforced in the service, not here.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiUser(request, "relationships:write");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiJson({ error: parsed.error.flatten() }, { status: 400 });

    const updated = await setParticipantVisibility(id, ctx.userId, parsed.data.visibility, parsed.data.hidden);
    return apiJson(updated);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
