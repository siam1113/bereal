import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, ForbiddenError } from "@/lib/auth-helpers";
import { createInquiry, listInquiriesForOffering } from "@/lib/services/service-offering-service";

const schema = z.object({ message: z.string().min(1) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    const inquiries = await listInquiriesForOffering(id, user.id);
    return NextResponse.json({ inquiries });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const inquiry = await createInquiry(id, user.id, parsed.data.message);
  return NextResponse.json({ inquiry }, { status: 201 });
}
