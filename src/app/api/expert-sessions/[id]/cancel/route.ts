import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { SessionAuthError, cancelExpertSession } from "@/lib/services/expert-session-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const session = await cancelExpertSession(id, user.id);
    return NextResponse.json({ session });
  } catch (err) {
    if (err instanceof SessionAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
