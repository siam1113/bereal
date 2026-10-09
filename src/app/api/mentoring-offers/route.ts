import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { createMentoringOffer, listMentoringOffers } from "@/lib/services/mentoring-service";

const createSchema = z.object({
  skillId: z.string().min(1),
  title: z.string().min(3).max(140),
  description: z.string().min(10),
  format: z.enum(["ONE_ON_ONE", "GROUP", "EITHER"]).optional(),
  capacity: z.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skillId = searchParams.get("skillId") ?? undefined;
  const format = (searchParams.get("format") as "ONE_ON_ONE" | "GROUP" | "EITHER" | null) ?? undefined;
  const offers = await listMentoringOffers({ skillId, format });
  return NextResponse.json({ offers });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const offer = await createMentoringOffer(user.id, parsed.data);
  return NextResponse.json({ offer }, { status: 201 });
}
