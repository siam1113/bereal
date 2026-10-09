import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { SessionAuthError, createExpertSession, listExpertSessions } from "@/lib/services/expert-session-service";

const createSchema = z.object({
  skillId: z.string().optional(),
  mentoringOfferId: z.string().optional(),
  title: z.string().min(3).max(140),
  description: z.string().max(4000).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  capacity: z.number().int().min(1).max(500).optional(),
  locationType: z.enum(["ONSITE", "REMOTE", "HYBRID"]).optional(),
  geoScope: z.enum(["LOCAL", "REGION", "GLOBAL"]).optional(),
  locationNote: z.string().max(500).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skillId = searchParams.get("skillId") ?? undefined;
  const upcomingOnly = searchParams.get("upcomingOnly") !== "false";
  const sessions = await listExpertSessions({ skillId, upcomingOnly });
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const session = await createExpertSession(user.id, parsed.data);
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    if (err instanceof SessionAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
