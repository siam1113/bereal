import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import {
  BusinessRelationshipAuthError,
  addBusinessRelationshipEvidence,
} from "@/lib/services/business-relationship-service";

const schema = z.object({
  description: z.string().min(1).max(2000),
  portfolioItemId: z.string().optional(),
  url: z.string().url().optional(),
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
    const evidence = await addBusinessRelationshipEvidence({
      businessRelationshipId: id,
      addedByUserId: user.id,
      ...parsed.data,
    });
    return NextResponse.json(evidence, { status: 201 });
  } catch (err) {
    if (err instanceof BusinessRelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
