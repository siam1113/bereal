import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { PrivateNetworkAuthError, linkRelationshipToNetwork } from "@/lib/services/private-network-service";

const schema = z.object({ networkId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const link = await linkRelationshipToNetwork(id, parsed.data.networkId, user.id);
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    if (err instanceof PrivateNetworkAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
