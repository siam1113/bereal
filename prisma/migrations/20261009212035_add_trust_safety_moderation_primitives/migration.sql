-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ModerationFlagStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ESCALATED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewCaseType" AS ENUM ('VERIFICATION', 'DISPUTE', 'ABUSE_FLAG');

-- CreateEnum
CREATE TYPE "ReviewTier" AS ENUM ('QUICK_PATH', 'DEEP_REVIEW');

-- CreateEnum
CREATE TYPE "ReviewPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ReviewCaseStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "ModerationFlag" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "subjectUserId" TEXT,
    "patternType" TEXT NOT NULL,
    "severity" "FlagSeverity" NOT NULL DEFAULT 'MEDIUM',
    "detectorId" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" "ModerationFlagStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "ModerationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewCase" (
    "id" TEXT NOT NULL,
    "caseType" "ReviewCaseType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "subjectUserId" TEXT,
    "tier" "ReviewTier",
    "priority" "ReviewPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ReviewCaseStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slaDueAt" TIMESTAMP(3),
    "firstActionAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "notes" TEXT,

    CONSTRAINT "ReviewCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyMetricEvent" (
    "id" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "value" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "SafetyMetricEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationFlag_status_idx" ON "ModerationFlag"("status");

-- CreateIndex
CREATE INDEX "ModerationFlag_entityType_entityId_idx" ON "ModerationFlag"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ModerationFlag_subjectUserId_idx" ON "ModerationFlag"("subjectUserId");

-- CreateIndex
CREATE INDEX "ReviewCase_status_idx" ON "ReviewCase"("status");

-- CreateIndex
CREATE INDEX "ReviewCase_entityType_entityId_idx" ON "ReviewCase"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ReviewCase_assignedToUserId_status_idx" ON "ReviewCase"("assignedToUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCase_caseType_entityType_entityId_key" ON "ReviewCase"("caseType", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "SafetyMetricEvent_metricType_occurredAt_idx" ON "SafetyMetricEvent"("metricType", "occurredAt");

-- CreateIndex
CREATE INDEX "SafetyMetricEvent_entityType_entityId_idx" ON "SafetyMetricEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "ModerationFlag" ADD CONSTRAINT "ModerationFlag_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationFlag" ADD CONSTRAINT "ModerationFlag_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCase" ADD CONSTRAINT "ReviewCase_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCase" ADD CONSTRAINT "ReviewCase_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyMetricEvent" ADD CONSTRAINT "SafetyMetricEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
