import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { PrivateNetworkStateError, respondToPrivateNetworkInvite } from "@/lib/services/private-network-service";

const schema = z.object({ accept: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const membership = await respondToPrivateNetworkInvite(id, user.id, parsed.data.accept);
    return NextResponse.json(membership);
  } catch (err) {
    if (err instanceof PrivateNetworkStateError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
