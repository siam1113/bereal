import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { SessionAuthError, SessionCapacityError, bookExpertSession } from "@/lib/services/expert-session-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const booking = await bookExpertSession(id, user.id);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (err instanceof SessionAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof SessionCapacityError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
