import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { applyToOpportunity } from "@/lib/services/opportunity-service";

const schema = z.object({ coverMessage: z.string().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const application = await applyToOpportunity(id, user.id, parsed.data.coverMessage);
  return NextResponse.json({ application }, { status: 201 });
}
