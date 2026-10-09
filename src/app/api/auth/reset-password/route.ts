import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";
import { consumePasswordResetToken, markPasswordResetTokenUsed } from "@/lib/auth-tokens";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { token, password } = parsed.data;
  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json({ error: "Password too weak" }, { status: 400 });
  }

  const result = await consumePasswordResetToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: result.userId }, data: { passwordHash } });
  await markPasswordResetTokenUsed(token);

  return NextResponse.json({ ok: true });
}
