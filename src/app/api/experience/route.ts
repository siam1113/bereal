import { NextResponse } from "next/server";
import { z } from "zod";
import { createExperience, listOwnExperience } from "@/lib/services/experience-service";

const schema = z.object({
  title: z.string().min(1).max(160),
  organizationName: z.string().min(1).max(160),
  linkedBusinessId: z.string().nullable().optional(),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  description: z.string().max(4000).optional(),
});

export async function GET() {
  const items = await listOwnExperience();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const item = await createExperience(parsed.data);
  return NextResponse.json({ item });
}
