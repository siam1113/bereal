import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { MentoringAuthError, getMentoringProgramDetail } from "@/lib/services/mentoring-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const program = await getMentoringProgramDetail(id, user.id);
    if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(program);
  } catch (err) {
    if (err instanceof MentoringAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
