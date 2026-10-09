import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, verificationEmail, passwordResetEmail } from "@/lib/mail";

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1h

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export async function issueEmailVerificationToken(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const token = generateToken();
  await prisma.emailVerificationToken.create({
    data: { userId, token, expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS) },
  });
  const url = `${baseUrl()}/api/auth/verify-email?token=${token}`;
  const email = verificationEmail(url);
  await sendEmail({ to: user.email, ...email });
}

export async function consumeEmailVerificationToken(token: string): Promise<{ ok: boolean }> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expires < new Date()) return { ok: false };

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date(), status: "ACTIVE" },
    }),
  ]);
  return { ok: true };
}

export async function issuePasswordResetToken(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Always behave as if it succeeded — don't leak whether an email is registered.
  if (!user) return;

  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expires: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
  });
  const url = `${baseUrl()}/reset-password?token=${token}`;
  const email_ = passwordResetEmail(url);
  await sendEmail({ to: user.email, ...email_ });
}

export async function consumePasswordResetToken(
  token: string,
): Promise<{ ok: true; userId: string } | { ok: false }> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expires < new Date()) return { ok: false };
  return { ok: true, userId: record.userId };
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  await prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } });
}
