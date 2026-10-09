import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestSkill } from "@/lib/services/skill-service";

const schema = z.object({
  name: z.string().min(1).max(80),
  categoryGroup: z
    .enum([
      "TRADES",
      "ARTS",
      "AGRICULTURE",
      "HEALTHCARE_ADJACENT",
      "TECHNOLOGY",
      "BUSINESS_PROFESSIONAL",
      "OTHER",
    ])
    .optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const skill = await suggestSkill(parsed.data.name, parsed.data.categoryGroup);
  return NextResponse.json({ skill });
}
