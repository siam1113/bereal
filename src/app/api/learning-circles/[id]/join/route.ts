import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { CircleAuthError, CircleCapacityError, requestToJoinCircle } from "@/lib/services/learning-circle-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const membership = await requestToJoinCircle(id, user.id);
    return NextResponse.json({ membership }, { status: 201 });
  } catch (err) {
    if (err instanceof CircleAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof CircleCapacityError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
