-- CreateEnum
CREATE TYPE "MentoringFormat" AS ENUM ('ONE_ON_ONE', 'GROUP', 'EITHER');

-- CreateEnum
CREATE TYPE "MentoringRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ExpertSessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExpertSessionBookingStatus" AS ENUM ('BOOKED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "LearningCircleMembershipRole" AS ENUM ('ORGANIZER', 'MEMBER');

-- CreateEnum
CREATE TYPE "LearningCircleMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'LEFT', 'REMOVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MENTORING_REQUEST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'MENTORING_REQUEST_DECISION';
ALTER TYPE "NotificationType" ADD VALUE 'EXPERT_SESSION_BOOKED';
ALTER TYPE "NotificationType" ADD VALUE 'EXPERT_SESSION_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'LEARNING_CIRCLE_JOIN_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'LEARNING_CIRCLE_MEMBERSHIP_DECISION';

-- CreateTable
CREATE TABLE "MentoringOffer" (
    "id" TEXT NOT NULL,
    "mentorUserId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "format" "MentoringFormat" NOT NULL DEFAULT 'ONE_ON_ONE',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentoringOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringRequest" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "menteeUserId" TEXT NOT NULL,
    "message" TEXT,
    "status" "MentoringRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resultingRelationshipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "MentoringRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertSession" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "mentoringOfferId" TEXT,
    "skillId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "status" "ExpertSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "locationType" "LocationType" NOT NULL DEFAULT 'REMOTE',
    "geoScope" "GeoScope" NOT NULL DEFAULT 'GLOBAL',
    "locationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertSessionBooking" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attendeeUserId" TEXT NOT NULL,
    "status" "ExpertSessionBookingStatus" NOT NULL DEFAULT 'BOOKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "ExpertSessionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCircle" (
    "id" TEXT NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "skillId" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "geoScope" "GeoScope" NOT NULL DEFAULT 'LOCAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningCircle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCircleMembership" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "LearningCircleMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "status" "LearningCircleMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningCircleMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentoringOffer_skillId_isActive_idx" ON "MentoringOffer"("skillId", "isActive");

-- CreateIndex
CREATE INDEX "MentoringOffer_mentorUserId_idx" ON "MentoringOffer"("mentorUserId");

-- CreateIndex
CREATE INDEX "MentoringRequest_offerId_status_idx" ON "MentoringRequest"("offerId", "status");

-- CreateIndex
CREATE INDEX "MentoringRequest_menteeUserId_idx" ON "MentoringRequest"("menteeUserId");

-- CreateIndex
CREATE INDEX "ExpertSession_skillId_status_startsAt_idx" ON "ExpertSession"("skillId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "ExpertSession_hostUserId_idx" ON "ExpertSession"("hostUserId");

-- CreateIndex
CREATE INDEX "ExpertSessionBooking_sessionId_status_idx" ON "ExpertSessionBooking"("sessionId", "status");

-- CreateIndex
CREATE INDEX "ExpertSessionBooking_attendeeUserId_idx" ON "ExpertSessionBooking"("attendeeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpertSessionBooking_sessionId_attendeeUserId_key" ON "ExpertSessionBooking"("sessionId", "attendeeUserId");

-- CreateIndex
CREATE INDEX "LearningCircle_skillId_geoScope_isActive_idx" ON "LearningCircle"("skillId", "geoScope", "isActive");

-- CreateIndex
CREATE INDEX "LearningCircle_creatorUserId_idx" ON "LearningCircle"("creatorUserId");

-- CreateIndex
CREATE INDEX "LearningCircleMembership_circleId_status_idx" ON "LearningCircleMembership"("circleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCircleMembership_circleId_userId_key" ON "LearningCircleMembership"("circleId", "userId");

-- AddForeignKey
ALTER TABLE "MentoringOffer" ADD CONSTRAINT "MentoringOffer_mentorUserId_fkey" FOREIGN KEY ("mentorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringOffer" ADD CONSTRAINT "MentoringOffer_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringRequest" ADD CONSTRAINT "MentoringRequest_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MentoringOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringRequest" ADD CONSTRAINT "MentoringRequest_menteeUserId_fkey" FOREIGN KEY ("menteeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertSession" ADD CONSTRAINT "ExpertSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertSession" ADD CONSTRAINT "ExpertSession_mentoringOfferId_fkey" FOREIGN KEY ("mentoringOfferId") REFERENCES "MentoringOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertSession" ADD CONSTRAINT "ExpertSession_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertSessionBooking" ADD CONSTRAINT "ExpertSessionBooking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExpertSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertSessionBooking" ADD CONSTRAINT "ExpertSessionBooking_attendeeUserId_fkey" FOREIGN KEY ("attendeeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCircle" ADD CONSTRAINT "LearningCircle_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCircle" ADD CONSTRAINT "LearningCircle_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCircleMembership" ADD CONSTRAINT "LearningCircleMembership_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "LearningCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCircleMembership" ADD CONSTRAINT "LearningCircleMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
