import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { CircleAuthError, leaveOrRemoveMember } from "@/lib/services/learning-circle-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const user = await requireUser();
  const { id, userId } = await params;
  try {
    const membership = await leaveOrRemoveMember(id, user.id, userId);
    return NextResponse.json({ membership });
  } catch (err) {
    if (err instanceof CircleAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
