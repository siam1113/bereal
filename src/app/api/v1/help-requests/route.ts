import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { createHelpRequest, listHelpRequests } from "@/lib/services/help-request-service";

const createSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(10),
  skillId: z.string().optional(),
  geoScope: z.enum(["LOCAL", "REGION", "GLOBAL"]),
});

/** Public, same as the legacy /api/help-requests — browsing requests never requires auth. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skillId = searchParams.get("skillId") ?? undefined;
  const geoScope = (searchParams.get("geoScope") as "LOCAL" | "REGION" | "GLOBAL" | null) ?? undefined;
  const helpRequests = await listHelpRequests({ skillId, geoScope });
  return apiJson({ helpRequests });
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiUser(request, "help-requests:write");
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiJson({ error: parsed.error.flatten() }, { status: 400 });

    const created = await createHelpRequest(ctx.userId, parsed.data);
    return apiJson({ helpRequest: created }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
