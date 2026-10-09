import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { CircleAuthError, CircleCapacityError, decideMembership } from "@/lib/services/learning-circle-service";

const schema = z.object({ approve: z.boolean() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const user = await requireUser();
  const { id, userId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const membership = await decideMembership(id, user.id, userId, parsed.data.approve);
    return NextResponse.json({ membership });
  } catch (err) {
    if (err instanceof CircleAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof CircleCapacityError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
