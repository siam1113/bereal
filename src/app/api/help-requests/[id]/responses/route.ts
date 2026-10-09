import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { respondToHelpRequest } from "@/lib/services/help-request-service";

const schema = z.object({ message: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const response = await respondToHelpRequest(id, user.id, parsed.data.message);
  return NextResponse.json({ response }, { status: 201 });
}
