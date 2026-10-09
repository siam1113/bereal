import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Every claim decision, relationship confirmation/dispute resolution, moderation action,
 * and badge award/revocation should call this — it's the audit trail the plan requires
 * for anything with "provenance, reviewer, timestamp" implications (section 6 invariant).
 */
export async function logAudit(input: {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
