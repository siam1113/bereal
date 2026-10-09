import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Instrumentation for the roadmap's named safety metrics (complaint rate, dispute
 * resolution time, false verification rate, privacy incidents — see
 * docs/roadmap/09-trust-safety-and-moderation.md). `SafetyMetricEvent` is an
 * append-only log; this file writes to it and computes the summary aggregates.
 *
 * What's real today vs. a placeholder — see this track's final report:
 *   - Complaint rate, dispute resolution time, and flag volume/confirmation rate
 *     are computed from real data already in this schema (`Report`,
 *     `RelationshipDispute`/`ReviewCase`, `ModerationFlag`).
 *   - "False verification rate" has no real signal source yet in this worktree —
 *     Track 2's `ClaimAppeal` (an approved claim later overturned on appeal) is the
 *     right source for it and hasn't merged here. `getFalseVerificationRate()`
 *     returns `null` with an explanatory `reason` rather than inventing a number.
 *   - "Privacy incident" has no dedicated reporting path yet; it's wired to count
 *     `SafetyMetricEvent`s of type `PRIVACY_INCIDENT`, which nothing currently
 *     writes — see the report for why this is left for a human decision (what
 *     counts as a privacy incident is itself a policy question).
 */

export async function recordSafetyMetricEvent(input: {
  metricType: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  durationMs?: number;
  value?: number;
  metadata?: Record<string, unknown>;
}) {
  return prisma.safetyMetricEvent.create({
    data: {
      metricType: input.metricType,
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId,
      durationMs: input.durationMs,
      value: input.value,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export interface SafetyMetricsSummary {
  windowDays: number;
  complaintRate: { reportsFiled: number; usersActive: number; perHundredUsers: number | null };
  disputeResolutionTime: { resolvedCount: number; avgHours: number | null; p90Hours: number | null };
  verificationReviewTime: { resolvedCount: number; avgHours: number | null };
  abuseFlags: { raised: number; confirmed: number; dismissed: number; confirmationRate: number | null };
  falseVerificationRate: { value: null; reason: string };
  privacyIncidents: { count: number; reason: string };
}

function hoursBetween(ms: number) {
  return ms / 36e5;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export async function getSafetyMetricsSummary(windowDays = 30): Promise<SafetyMetricsSummary> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [reportsFiled, usersActive, resolvedDisputeCases, resolvedVerificationCases, flagsRaised, flagsConfirmed, flagsDismissed, privacyIncidentCount] =
    await Promise.all([
      prisma.report.count({ where: { createdAt: { gte: since } } }),
      prisma.user.count({ where: { status: { not: "DELETED" }, createdAt: { lte: new Date() } } }),
      prisma.reviewCase.findMany({
        where: { caseType: "DISPUTE", status: "RESOLVED", resolvedAt: { gte: since } },
        select: { openedAt: true, resolvedAt: true },
      }),
      prisma.reviewCase.findMany({
        where: { caseType: "VERIFICATION", status: "RESOLVED", resolvedAt: { gte: since } },
        select: { openedAt: true, resolvedAt: true },
      }),
      prisma.moderationFlag.count({ where: { createdAt: { gte: since } } }),
      prisma.moderationFlag.count({ where: { status: "ESCALATED", createdAt: { gte: since } } }),
      prisma.moderationFlag.count({ where: { status: "DISMISSED", createdAt: { gte: since } } }),
      prisma.safetyMetricEvent.count({ where: { metricType: "PRIVACY_INCIDENT", occurredAt: { gte: since } } }),
    ]);

  const disputeHours = resolvedDisputeCases
    .map((c) => (c.resolvedAt ? hoursBetween(c.resolvedAt.getTime() - c.openedAt.getTime()) : null))
    .filter((h): h is number => h !== null)
    .sort((a, b) => a - b);

  const verificationHours = resolvedVerificationCases
    .map((c) => (c.resolvedAt ? hoursBetween(c.resolvedAt.getTime() - c.openedAt.getTime()) : null))
    .filter((h): h is number => h !== null);

  const triagedFlags = flagsConfirmed + flagsDismissed;

  return {
    windowDays,
    complaintRate: {
      reportsFiled,
      usersActive,
      perHundredUsers: usersActive > 0 ? (reportsFiled / usersActive) * 100 : null,
    },
    disputeResolutionTime: {
      resolvedCount: disputeHours.length,
      avgHours: disputeHours.length > 0 ? disputeHours.reduce((a, b) => a + b, 0) / disputeHours.length : null,
      p90Hours: percentile(disputeHours, 90),
    },
    verificationReviewTime: {
      resolvedCount: verificationHours.length,
      avgHours:
        verificationHours.length > 0 ? verificationHours.reduce((a, b) => a + b, 0) / verificationHours.length : null,
    },
    abuseFlags: {
      raised: flagsRaised,
      confirmed: flagsConfirmed,
      dismissed: flagsDismissed,
      confirmationRate: triagedFlags > 0 ? flagsConfirmed / triagedFlags : null,
    },
    falseVerificationRate: {
      value: null,
      reason:
        "No overturned-verification signal exists in this worktree yet — needs Track 2's ClaimAppeal " +
        "(an approved claim later overturned on appeal). Flagged in this track's report, not invented here.",
    },
    privacyIncidents: {
      count: privacyIncidentCount,
      reason:
        "Counts SafetyMetricEvent rows of type PRIVACY_INCIDENT; nothing currently writes one — what " +
        "qualifies as a privacy incident is a policy question, flagged in this track's report.",
    },
  };
}
