import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { RelationshipAuthError } from "@/lib/services/relationship-service";
import { setReferenceVisibility } from "@/lib/services/reference-service";

const schema = z.object({ visibility: z.enum(["PUBLIC", "CONNECTIONS", "PRIVATE"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const reference = await setReferenceVisibility(id, user.id, parsed.data.visibility);
    return NextResponse.json({ reference });
  } catch (err) {
    if (err instanceof RelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
