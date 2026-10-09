import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { getProfileByUserId, updateProfileByUserId } from "@/lib/services/profile-service";

const schema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(2000).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  languages: z.array(z.string()).optional(),
  availability: z.enum(["OPEN_TO_WORK", "OPEN_TO_COLLAB", "LIMITED", "NOT_AVAILABLE"]).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireApiUser(request, "profile:read");
    const profile = await getProfileByUserId(ctx.userId);
    return apiJson({ profile });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireApiUser(request, "profile:write");
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiJson({ error: parsed.error.flatten() }, { status: 400 });

    const profile = await updateProfileByUserId(ctx.userId, parsed.data);
    return apiJson({ profile });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
