import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import {
  BusinessRelationshipAuthError,
  raiseBusinessRelationshipDispute,
} from "@/lib/services/business-relationship-service";

const schema = z.object({ reason: z.string().min(1).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!rateLimit(`biz-rel-dispute:${user.id}`, 10, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many disputes filed, try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const dispute = await raiseBusinessRelationshipDispute(id, user.id, parsed.data.reason);
    return NextResponse.json(dispute, { status: 201 });
  } catch (err) {
    if (err instanceof BusinessRelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
