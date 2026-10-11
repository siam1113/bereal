import { prisma } from "@/lib/prisma";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";
import { issueEmailVerificationToken, consumePasswordResetToken, markPasswordResetTokenUsed } from "@/lib/auth-tokens";
import { uniqueSlug } from "@/lib/slug";

/**
 * Account lifecycle logic that used to live directly in the three
 * `src/app/api/auth/{register,reset-password,delete-account}` route handlers — pulled out
 * here per the Track 7 audit (routes should be thin wrappers over the service layer, same
 * as every other feature area; these three were the only routes in the app that weren't).
 */

export class WeakPasswordError extends Error {
  constructor(message = "Password too weak") {
    super(message);
  }
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ ok: true }> {
  if (!isPasswordStrongEnough(input.password)) throw new WeakPasswordError();

  const normalizedEmail = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    // Don't reveal which emails are registered — caller still reports success.
    return { ok: true };
  }

  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueSlug(input.displayName, async (candidate) => {
    const found = await prisma.personProfile.findUnique({ where: { slug: candidate } });
    return !!found;
  });

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.displayName,
      passwordHash,
      personProfile: {
        create: { slug, displayName: input.displayName },
      },
    },
  });

  await issueEmailVerificationToken(user.id);
  return { ok: true };
}

/**
 * Soft-deletes the given account: scrubs login-identifying fields but keeps the row (and
 * PersonProfile) so other users' Relationship/Endorsement/ProfessionalFeedback rows
 * referencing this person stay referentially intact — see
 * docs/data-model.md#soft-deleted-accounts. The profile is hidden from discovery by
 * status, not by deletion.
 */
export async function deleteAccount(userId: string): Promise<{ ok: true }> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "DELETED",
      deletedAt: new Date(),
      email: `deleted-${userId}@deleted.proverse.invalid`,
      passwordHash: null,
      name: "Deleted user",
      image: null,
    },
  });
  return { ok: true };
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPasswordStrongEnough(newPassword)) return { ok: false, error: "Password too weak" };

  const result = await consumePasswordResetToken(token);
  if (!result.ok) return { ok: false, error: "Invalid or expired token" };

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: result.userId }, data: { passwordHash } });
  await markPasswordResetTokenUsed(token);
  return { ok: true };
}
