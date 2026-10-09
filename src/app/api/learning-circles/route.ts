import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { createLearningCircle, listLearningCircles } from "@/lib/services/learning-circle-service";

const createSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(4000).optional(),
  skillId: z.string().optional(),
  capacity: z.number().int().min(2).max(100).optional(),
  geoScope: z.enum(["LOCAL", "REGION", "GLOBAL"]).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skillId = searchParams.get("skillId") ?? undefined;
  const geoScope = (searchParams.get("geoScope") as "LOCAL" | "REGION" | "GLOBAL" | null) ?? undefined;
  const circles = await listLearningCircles({ skillId, geoScope });
  return NextResponse.json({ circles });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const circle = await createLearningCircle(user.id, parsed.data);
  return NextResponse.json({ circle }, { status: 201 });
}
