import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { RelationshipAuthError } from "@/lib/services/relationship-service";
import { removeProjectAnchor } from "@/lib/services/team-history-service";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; portfolioItemId: string }> },
) {
  const user = await requireUser();
  const { id, portfolioItemId } = await params;
  try {
    await removeProjectAnchor(id, portfolioItemId, user.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof RelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
