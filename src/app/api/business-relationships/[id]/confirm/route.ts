import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import {
  BusinessRelationshipAuthError,
  confirmBusinessRelationship,
} from "@/lib/services/business-relationship-service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const rel = await confirmBusinessRelationship(id, user.id);
    return NextResponse.json(rel);
  } catch (err) {
    if (err instanceof BusinessRelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
