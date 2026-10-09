import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import {
  RelationshipAuthError,
  RelationshipStateError,
  respondToFamilyConsent,
} from "@/lib/services/relationship-service";

const schema = z.object({ grant: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await respondToFamilyConsent(id, user.id, parsed.data.grant);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof RelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof RelationshipStateError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
