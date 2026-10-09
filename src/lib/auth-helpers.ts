import { auth } from "@/lib/auth";

export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Not allowed") {
    super(message);
  }
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Throws if there is no signed-in user. Use in server actions / route handlers. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "MODERATOR") throw new ForbiddenError();
  return user;
}
