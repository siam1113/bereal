import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import type { Prisma } from "@prisma/client";
import {
  MentoringAuthError,
  MentoringStateError,
  listMyMentoringPrograms,
  proposeMentoringProgram,
} from "@/lib/services/mentoring-service";

const schema = z.object({
  mentorUserId: z.string().min(1),
  menteeUserId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  focusSkillId: z.string().optional(),
  // Free-form milestone/goal list — shape owned by the caller, not the service.
  goals: z.array(z.string().max(500)).max(50).optional(),
  relationshipId: z.string().optional(),
});

export async function GET() {
  const user = await requireUser();
  const programs = await listMyMentoringPrograms(user.id);
  return NextResponse.json(programs);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`mentoring-propose:${user.id}`, 20, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const program = await proposeMentoringProgram({
      proposedByUserId: user.id,
      ...parsed.data,
      goals: parsed.data.goals as Prisma.InputJsonValue | undefined,
    });
    return NextResponse.json(program, { status: 201 });
  } catch (err) {
    if (err instanceof MentoringAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof MentoringStateError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
