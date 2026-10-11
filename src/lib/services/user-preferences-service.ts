import type { NavPosition } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

export async function getNavPosition(): Promise<NavPosition> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return "LEFT";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { navPosition: true },
  });
  return user?.navPosition ?? "LEFT";
}

export async function updateNavPosition(navPosition: NavPosition) {
  const user = await requireUser();
  return prisma.user.update({
    where: { id: user.id },
    data: { navPosition },
    select: { navPosition: true },
  });
}
