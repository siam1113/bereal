import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { PrivateNetworkAuthError, removeFromPrivateNetwork } from "@/lib/services/private-network-service";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const user = await requireUser();
  const { id, userId } = await params;
  try {
    await removeFromPrivateNetwork(id, user.id, userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof PrivateNetworkAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
