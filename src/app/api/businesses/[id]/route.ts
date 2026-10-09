import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnBusinessById, updateBusiness } from "@/lib/services/business-service";

const schema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getOwnBusinessById(id);
  return NextResponse.json({ business });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const business = await updateBusiness(id, parsed.data);
  return NextResponse.json({ business });
}
