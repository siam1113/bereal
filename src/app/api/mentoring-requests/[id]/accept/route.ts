import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import {
  MentoringAuthError,
  MentoringCapacityError,
  acceptMentoringRequest,
} from "@/lib/services/mentoring-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const updated = await acceptMentoringRequest(id, user.id);
    return NextResponse.json({ request: updated });
  } catch (err) {
    if (err instanceof MentoringAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof MentoringCapacityError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
