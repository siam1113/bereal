import { NextResponse } from "next/server";
import { z } from "zod";
import { createBusiness, listOwnBusinesses } from "@/lib/services/business-service";

const schema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
});

export async function GET() {
  const businesses = await listOwnBusinesses();
  return NextResponse.json({ businesses });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const business = await createBusiness(parsed.data);
  return NextResponse.json({ business });
}
