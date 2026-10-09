import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { RelationshipAuthError, RelationshipStateError } from "@/lib/services/relationship-service";
import { appealClaim } from "@/lib/services/claim-appeal-service";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ reason: z.string().min(1).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!rateLimit(`claim-appeal:${user.id}`, 10, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many appeals filed, try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const appeal = await appealClaim(id, user.id, parsed.data.reason);
    return NextResponse.json({ appeal }, { status: 201 });
  } catch (err) {
    if (err instanceof RelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof RelationshipStateError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
