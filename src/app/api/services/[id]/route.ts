import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, ForbiddenError } from "@/lib/auth-helpers";
import { deleteServiceOffering, getServiceOffering, updateServiceOffering } from "@/lib/services/service-offering-service";

const updateSchema = z.object({
  title: z.string().min(3).max(140).optional(),
  description: z.string().min(10).optional(),
  skillId: z.string().nullable().optional(),
  priceNote: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offering = await getServiceOffering(id);
  if (!offering) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ offering });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const updated = await updateServiceOffering(id, user.id, parsed.data);
    return NextResponse.json({ offering: updated });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    await deleteServiceOffering(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
