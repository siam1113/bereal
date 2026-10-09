import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, ForbiddenError } from "@/lib/auth-helpers";
import { OpportunityValidationError, addTeamSlot } from "@/lib/services/opportunity-service";

const schema = z.object({
  roleTitle: z.string().min(2).max(80),
  skillId: z.string().optional(),
  headcountNeeded: z.number().int().min(1).max(50).optional(),
});

/** Poster-only: add another open role to an existing TEAM_PROJECT opportunity. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const slot = await addTeamSlot(id, user.id, parsed.data);
    return NextResponse.json({ teamSlot: slot }, { status: 201 });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof OpportunityValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
