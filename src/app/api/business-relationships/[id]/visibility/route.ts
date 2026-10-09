import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import {
  BusinessRelationshipAuthError,
  setBusinessRelationshipVisibility,
} from "@/lib/services/business-relationship-service";

const schema = z.object({
  side: z.enum(["A", "B"]),
  visibility: z.enum(["PUBLIC", "CONNECTIONS", "PRIVATE"]),
  hidden: z.boolean(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await setBusinessRelationshipVisibility(
      id,
      parsed.data.side,
      user.id,
      parsed.data.visibility,
      parsed.data.hidden,
    );
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof BusinessRelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
