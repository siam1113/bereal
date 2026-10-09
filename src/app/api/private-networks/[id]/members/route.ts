import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import {
  PrivateNetworkAuthError,
  PrivateNetworkStateError,
  inviteToPrivateNetwork,
  listNetworkMembers,
} from "@/lib/services/private-network-service";

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const members = await listNetworkMembers(id, user.id);
    return NextResponse.json(members);
  } catch (err) {
    if (err instanceof PrivateNetworkAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const membership = await inviteToPrivateNetwork(id, user.id, parsed.data.userId, parsed.data.role);
    return NextResponse.json(membership, { status: 201 });
  } catch (err) {
    if (err instanceof PrivateNetworkAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof PrivateNetworkStateError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
