import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { createOpportunity, listOpportunities } from "@/lib/services/opportunity-service";

const createSchema = z.object({
  businessId: z.string().optional(),
  type: z.enum(["TASK", "CONTRACT", "FULL_TIME"]),
  title: z.string().min(3).max(140),
  description: z.string().min(10),
  skillId: z.string().optional(),
  locationType: z.enum(["ONSITE", "REMOTE", "HYBRID"]),
  geoScope: z.enum(["LOCAL", "REGION", "GLOBAL"]),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const opportunities = await listOpportunities({
    skillId: searchParams.get("skillId") ?? undefined,
    geoScope: (searchParams.get("geoScope") as "LOCAL" | "REGION" | "GLOBAL" | null) ?? undefined,
    type: (searchParams.get("type") as "TASK" | "CONTRACT" | "FULL_TIME" | null) ?? undefined,
  });
  return NextResponse.json({ opportunities });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await createOpportunity(user.id, parsed.data);
  return NextResponse.json({ opportunity: created }, { status: 201 });
}
