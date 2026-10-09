import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { createPrivateNetwork, listMyPrivateNetworks } from "@/lib/services/private-network-service";

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  membershipVisible: z.boolean().optional(),
});

export async function GET() {
  const user = await requireUser();
  const memberships = await listMyPrivateNetworks(user.id);
  return NextResponse.json(memberships);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`private-network-create:${user.id}`, 10, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const network = await createPrivateNetwork({ createdByUserId: user.id, ...parsed.data });
  return NextResponse.json(network, { status: 201 });
}
