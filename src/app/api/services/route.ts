import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { createServiceOffering, listServiceOfferings } from "@/lib/services/service-offering-service";

const createSchema = z.object({
  personProfileId: z.string().optional(),
  businessId: z.string().optional(),
  title: z.string().min(3).max(140),
  description: z.string().min(10),
  skillId: z.string().optional(),
  priceNote: z.string().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offerings = await listServiceOfferings({
    skillId: searchParams.get("skillId") ?? undefined,
    query: searchParams.get("q") ?? undefined,
  });
  return NextResponse.json({ offerings });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await createServiceOffering(user.id, parsed.data);
  return NextResponse.json({ offering: created }, { status: 201 });
}
