-- Track 4 (opportunity network): microtask/apprenticeship/team-project kinds on
-- Opportunity, plus a team-slot roster for TEAM_PROJECT opportunities.

-- CreateEnum
CREATE TYPE "OpportunityKind" AS ENUM ('STANDARD', 'MICROTASK', 'APPRENTICESHIP', 'TEAM_PROJECT');

-- DropIndex (replaced below by a partial unique index that preserves the original
-- "one application per opportunity per user" rule for non-team-slot applications,
-- while allowing a user to apply to multiple distinct team slots on the same
-- TEAM_PROJECT opportunity)
DROP INDEX "Application_opportunityId_applicantUserId_key";

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "teamSlotId" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "durationWeeks" INTEGER,
ADD COLUMN     "estimatedHours" INTEGER,
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "OpportunityKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "mentorshipFocus" TEXT,
ADD COLUMN     "recurrenceNote" TEXT;

-- CreateTable
CREATE TABLE "OpportunityTeamSlot" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "skillId" TEXT,
    "headcountNeeded" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityTeamSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityTeamSlot_opportunityId_idx" ON "OpportunityTeamSlot"("opportunityId");

-- CreateIndex
CREATE INDEX "Application_teamSlotId_idx" ON "Application"("teamSlotId");

-- CreateIndex
-- Full uniqueness incl. teamSlotId: prevents applying twice to the exact same slot
-- (and, since NULL <> NULL in Postgres uniqueness, does NOT by itself constrain the
-- non-team-slot case — that's handled by the partial index immediately below).
CREATE UNIQUE INDEX "Application_opportunityId_applicantUserId_teamSlotId_key" ON "Application"("opportunityId", "applicantUserId", "teamSlotId");

-- CreateIndex
-- Partial unique index: for applications NOT tied to a team slot (every pre-existing
-- Application row, and every application to a non-TEAM_PROJECT opportunity), restores
-- the original "one application per opportunity per user" invariant that the dropped
-- index above used to enforce unconditionally.
CREATE UNIQUE INDEX "Application_opportunityId_applicantUserId_no_slot_key" ON "Application"("opportunityId", "applicantUserId") WHERE "teamSlotId" IS NULL;

-- CreateIndex
CREATE INDEX "Opportunity_kind_idx" ON "Opportunity"("kind");

-- AddForeignKey
ALTER TABLE "OpportunityTeamSlot" ADD CONSTRAINT "OpportunityTeamSlot_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityTeamSlot" ADD CONSTRAINT "OpportunityTeamSlot_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_teamSlotId_fkey" FOREIGN KEY ("teamSlotId") REFERENCES "OpportunityTeamSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
