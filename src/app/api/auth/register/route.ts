import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";
import { issueEmailVerificationToken } from "@/lib/auth-tokens";
import { uniqueSlug } from "@/lib/slug";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(120),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, displayName } = parsed.data;

  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json({ error: "Password too weak" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    // Don't reveal which emails are registered.
    return NextResponse.json({ ok: true });
  }

  const passwordHash = await hashPassword(password);
  const slug = await uniqueSlug(displayName, async (candidate) => {
    const found = await prisma.personProfile.findUnique({ where: { slug: candidate } });
    return !!found;
  });

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: displayName,
      passwordHash,
      personProfile: {
        create: { slug, displayName },
      },
    },
  });

  await issueEmailVerificationToken(user.id);

  return NextResponse.json({ ok: true });
}
