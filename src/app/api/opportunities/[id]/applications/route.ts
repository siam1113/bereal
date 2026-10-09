import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { OpportunityValidationError, applyToOpportunity } from "@/lib/services/opportunity-service";

const schema = z.object({ coverMessage: z.string().optional(), teamSlotId: z.string().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const application = await applyToOpportunity(id, user.id, parsed.data);
    return NextResponse.json({ application }, { status: 201 });
  } catch (err) {
    if (err instanceof OpportunityValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
