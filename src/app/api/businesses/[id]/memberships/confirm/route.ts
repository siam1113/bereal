import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmBusinessMembership } from "@/lib/services/business-service";

const schema = z.object({ memberUserId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const membership = await confirmBusinessMembership(id, parsed.data.memberUserId);
  return NextResponse.json({ membership });
}
