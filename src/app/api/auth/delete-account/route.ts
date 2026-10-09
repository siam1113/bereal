import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

/**
 * Soft-deletes the signed-in account: scrubs login-identifying fields but keeps the row
 * (and PersonProfile) so relationships/claims other users hold about this person stay
 * referentially intact, per plan invariant that one party can't unilaterally erase
 * another's record of a shared history. The profile is hidden from discovery by status.
 */
export async function POST() {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "DELETED",
      deletedAt: new Date(),
      email: `deleted-${user.id}@deleted.common.invalid`,
      passwordHash: null,
      name: "Deleted user",
      image: null,
    },
  });

  return NextResponse.json({ ok: true });
}
