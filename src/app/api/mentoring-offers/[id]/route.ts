import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { MentoringAuthError, getMentoringOffer, updateMentoringOffer } from "@/lib/services/mentoring-service";

const updateSchema = z.object({
  title: z.string().min(3).max(140).optional(),
  description: z.string().min(10).optional(),
  format: z.enum(["ONE_ON_ONE", "GROUP", "EITHER"]).optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await getMentoringOffer(id);
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ offer });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const offer = await updateMentoringOffer(id, user.id, parsed.data);
    return NextResponse.json({ offer });
  } catch (err) {
    if (err instanceof MentoringAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
