import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import {
  MentoringAuthError,
  MentoringStateError,
  cancelMentoringProgram,
} from "@/lib/services/mentoring-service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const program = await cancelMentoringProgram(id, user.id);
    return NextResponse.json(program);
  } catch (err) {
    if (err instanceof MentoringAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof MentoringStateError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
