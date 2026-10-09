import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteExperience, updateExperience } from "@/lib/services/experience-service";

const schema = z.object({
  title: z.string().min(1).max(160),
  organizationName: z.string().min(1).max(160),
  linkedBusinessId: z.string().nullable().optional(),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  description: z.string().max(4000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const item = await updateExperience(id, parsed.data);
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteExperience(id);
  return NextResponse.json({ ok: true });
}
