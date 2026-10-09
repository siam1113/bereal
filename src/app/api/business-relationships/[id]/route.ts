import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import {
  BusinessRelationshipAuthError,
  getBusinessRelationshipDetail,
} from "@/lib/services/business-relationship-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const rel = await getBusinessRelationshipDetail(id, user.id);
    if (!rel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rel);
  } catch (err) {
    if (err instanceof BusinessRelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
