import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { PrivateNetworkAuthError, unlinkRelationshipFromNetwork } from "@/lib/services/private-network-service";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; networkId: string }> }) {
  const user = await requireUser();
  const { id, networkId } = await params;
  try {
    await unlinkRelationshipFromNetwork(id, networkId, user.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof PrivateNetworkAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
