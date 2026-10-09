-- CreateEnum
CREATE TYPE "AiFlagTargetType" AS ENUM ('CREDENTIAL_CLAIM', 'RELATIONSHIP', 'ENDORSEMENT', 'PROFESSIONAL_FEEDBACK');

-- CreateEnum
CREATE TYPE "AiFlagStatus" AS ENUM ('PENDING', 'REVIEWED_ACTIONED', 'REVIEWED_DISMISSED');

-- CreateTable
CREATE TABLE "AiModerationFlag" (
    "id" TEXT NOT NULL,
    "targetType" "AiFlagTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "status" "AiFlagStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModerationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiModerationFlag_status_targetType_idx" ON "AiModerationFlag"("status", "targetType");

-- CreateIndex
CREATE UNIQUE INDEX "AiModerationFlag_targetType_targetId_reasonCode_key" ON "AiModerationFlag"("targetType", "targetId", "reasonCode");

-- AddForeignKey
ALTER TABLE "AiModerationFlag" ADD CONSTRAINT "AiModerationFlag_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
