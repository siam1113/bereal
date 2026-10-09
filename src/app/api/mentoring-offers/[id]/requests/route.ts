import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { MentoringAuthError, listRequestsForOffer, requestMentoring } from "@/lib/services/mentoring-service";

const createSchema = z.object({ message: z.string().max(2000).optional() });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const requests = await listRequestsForOffer(id, user.id);
    return NextResponse.json({ requests });
  } catch (err) {
    if (err instanceof MentoringAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const created = await requestMentoring(id, user.id, parsed.data.message);
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (err) {
    if (err instanceof MentoringAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
