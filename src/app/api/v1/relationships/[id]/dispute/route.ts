import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { raiseDispute } from "@/lib/services/relationship-service";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ reason: z.string().min(1).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiUser(request, "relationships:write");
    const { id } = await params;
    if (!rateLimit(`dispute:${ctx.userId}`, 10, 60 * 60 * 1000).ok) {
      return apiJson({ error: "Too many disputes filed, try again later" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiJson({ error: parsed.error.flatten() }, { status: 400 });

    const dispute = await raiseDispute(id, ctx.userId, parsed.data.reason);
    return apiJson(dispute, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
