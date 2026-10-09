import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { RelationshipAuthError } from "@/lib/services/relationship-service";
import { getReferenceDetail } from "@/lib/services/reference-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const reference = await getReferenceDetail(id, user.id);
    if (!reference) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ reference });
  } catch (err) {
    if (err instanceof RelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
