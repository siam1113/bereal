import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
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

export async function GET() {
  const user = await requireUser();
  const requests = await listMyRelationshipRequests(user.id);
  return NextResponse.json(requests);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`rel-request:${user.id}`, 20, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const created = await createRelationshipRequest({ fromUserId: user.id, ...parsed.data });
  return NextResponse.json(created, { status: 201 });
}
