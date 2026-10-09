import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import {
  MentoringAuthError,
  MentoringStateError,
  respondToMentoringProgram,
} from "@/lib/services/mentoring-service";

const schema = z.object({ accept: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const program = await respondToMentoringProgram(id, user.id, parsed.data.accept);
    return NextResponse.json(program);
  } catch (err) {
    if (err instanceof MentoringAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof MentoringStateError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
