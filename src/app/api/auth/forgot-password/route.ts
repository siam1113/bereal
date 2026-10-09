import { NextResponse } from "next/server";
import { z } from "zod";
import { issuePasswordResetToken } from "@/lib/auth-tokens";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await issuePasswordResetToken(parsed.data.email);
  // Always 200 — never reveal whether the email is registered.
  return NextResponse.json({ ok: true });
}
