import { NextResponse } from "next/server";
import { z } from "zod";
import { addSecondarySkill, setPrimarySkill } from "@/lib/services/profile-service";

const schema = z.object({
  skillId: z.string().min(1),
  isPrimary: z.boolean().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.isPrimary) {
    await setPrimarySkill(parsed.data.skillId);
  } else {
    await addSecondarySkill(parsed.data.skillId);
  }
  return NextResponse.json({ ok: true });
}
