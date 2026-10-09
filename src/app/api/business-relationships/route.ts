import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import {
  BusinessRelationshipAuthError,
  BusinessRelationshipStateError,
  createBusinessRelationship,
  listMyBusinessRelationships,
} from "@/lib/services/business-relationship-service";

const TYPES = ["ENGAGEMENT", "ENDORSEMENT", "CLIENT_PROVIDER", "COLLABORATOR", "PARTNERSHIP"] as const;

const partySchema = z.union([
  z.object({ type: z.literal("PERSON"), userId: z.string().min(1) }),
  z.object({ type: z.literal("BUSINESS"), businessId: z.string().min(1) }),
]);

const schema = z.object({
  type: z.enum(TYPES),
  declaredForSide: z.enum(["A", "B"]),
  partyA: partySchema,
  partyARole: z.string().min(1).max(100),
  partyB: partySchema,
  partyBRole: z.string().min(1).max(100),
});

export async function GET() {
  const user = await requireUser();
  const relationships = await listMyBusinessRelationships(user.id);
  return NextResponse.json(relationships);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`biz-rel:${user.id}`, 20, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const created = await createBusinessRelationship({ declaredByUserId: user.id, ...parsed.data });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof BusinessRelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof BusinessRelationshipStateError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
