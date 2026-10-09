import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { OpportunityValidationError, createOpportunity, listOpportunities } from "@/lib/services/opportunity-service";

const teamSlotSchema = z.object({
  roleTitle: z.string().min(2).max(80),
  skillId: z.string().optional(),
  headcountNeeded: z.number().int().min(1).max(50).optional(),
});

const createSchema = z.object({
  businessId: z.string().optional(),
  type: z.enum(["TASK", "CONTRACT", "FULL_TIME"]),
  kind: z.enum(["STANDARD", "MICROTASK", "APPRENTICESHIP", "TEAM_PROJECT"]).optional(),
  title: z.string().min(3).max(140),
  description: z.string().min(10),
  skillId: z.string().optional(),
  locationType: z.enum(["ONSITE", "REMOTE", "HYBRID"]),
  geoScope: z.enum(["LOCAL", "REGION", "GLOBAL"]),
  // MICROTASK
  estimatedHours: z.number().int().min(1).max(10000).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceNote: z.string().max(200).optional(),
  // APPRENTICESHIP
  durationWeeks: z.number().int().min(1).max(520).optional(),
  mentorshipFocus: z.string().max(2000).optional(),
  // TEAM_PROJECT
  teamSlots: z.array(teamSlotSchema).max(20).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const opportunities = await listOpportunities({
    skillId: searchParams.get("skillId") ?? undefined,
    geoScope: (searchParams.get("geoScope") as "LOCAL" | "REGION" | "GLOBAL" | null) ?? undefined,
    type: (searchParams.get("type") as "TASK" | "CONTRACT" | "FULL_TIME" | null) ?? undefined,
    kind:
      (searchParams.get("kind") as "STANDARD" | "MICROTASK" | "APPRENTICESHIP" | "TEAM_PROJECT" | null) ?? undefined,
  });
  return NextResponse.json({ opportunities });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const created = await createOpportunity(user.id, parsed.data);
    return NextResponse.json({ opportunity: created }, { status: 201 });
  } catch (err) {
    if (err instanceof OpportunityValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
