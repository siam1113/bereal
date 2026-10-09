import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse, apiJson } from "@/lib/api/http";
import { rateLimit } from "@/lib/rate-limit";
import { createRelationshipRequest, listMyRelationshipRequests } from "@/lib/services/relationship-service";

const RELATIONSHIP_TYPES = [
  "WORKED_WITH",
  "COLLEAGUE",
  "COLLABORATOR",
  "CLIENT_PROVIDER",
  "MENTOR_MENTEE",
  "CONSULTANT_CLIENT",
  "BUSINESS_PARTNER",
  "FRIEND",
  "FAMILY",
  "LEARNING_FROM",
] as const;

const INTENTS = [
  "WANT_TO_COLLABORATE",
  "SEEK_MENTORSHIP",
  "SEEK_CONSULTATION",
  "INTERESTED_IN_HIRING",
  "WANT_TO_LEARN",
  "SOCIALIZE",
] as const;

const schema = z.object({
  toUserId: z.string().min(1),
  proposedType: z.enum(RELATIONSHIP_TYPES),
  intent: z.enum(INTENTS),
  message: z.string().max(1000).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireApiUser(request, "relationships:read");
    const requests = await listMyRelationshipRequests(ctx.userId);
    return apiJson(requests);
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiUser(request, "relationships:write");
    if (!rateLimit(`rel-request:${ctx.userId}`, 20, 60 * 60 * 1000).ok) {
      return apiJson({ error: "Too many requests, try again later" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiJson({ error: parsed.error.flatten() }, { status: 400 });

    const created = await createRelationshipRequest({ fromUserId: ctx.userId, ...parsed.data });
    return apiJson(created, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
