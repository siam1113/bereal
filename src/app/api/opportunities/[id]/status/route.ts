import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, ForbiddenError } from "@/lib/auth-helpers";
import { setOpportunityStatus } from "@/lib/services/opportunity-service";

const schema = z.object({ status: z.enum(["OPEN", "CLOSED"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const updated = await setOpportunityStatus(id, user.id, parsed.data.status);
    return NextResponse.json({ opportunity: updated });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
