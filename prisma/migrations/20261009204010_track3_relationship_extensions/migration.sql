-- CreateEnum
CREATE TYPE "BusinessRelationshipPartyKind" AS ENUM ('PERSON', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BusinessRelationshipType" AS ENUM ('ENGAGEMENT', 'ENDORSEMENT', 'CLIENT_PROVIDER', 'COLLABORATOR', 'PARTNERSHIP');

-- CreateEnum
CREATE TYPE "PartySide" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "MentoringProgramStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'DECLINED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrivateNetworkMembershipRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "PrivateNetworkMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED', 'DECLINED');

-- CreateTable
CREATE TABLE "RelationshipProjectLink" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "portfolioItemId" TEXT NOT NULL,
    "note" TEXT,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationshipProjectLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessRelationship" (
    "id" TEXT NOT NULL,
    "type" "BusinessRelationshipType" NOT NULL,
    "partyAType" "BusinessRelationshipPartyKind" NOT NULL,
    "partyAUserId" TEXT,
    "partyABusinessId" TEXT,
    "partyARole" TEXT NOT NULL,
    "partyBType" "BusinessRelationshipPartyKind" NOT NULL,
    "partyBUserId" TEXT,
    "partyBBusinessId" TEXT,
    "partyBRole" TEXT NOT NULL,
    "state" "RelationshipState" NOT NULL DEFAULT 'PROPOSED',
    "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'SELF_DECLARED',
    "declaredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessRelationshipParticipantVisibility" (
    "businessRelationshipId" TEXT NOT NULL,
    "side" "PartySide" NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessRelationshipParticipantVisibility_pkey" PRIMARY KEY ("businessRelationshipId","side")
);

-- CreateTable
CREATE TABLE "BusinessRelationshipEvidence" (
    "id" TEXT NOT NULL,
    "businessRelationshipId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "portfolioItemId" TEXT,
    "url" TEXT,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessRelationshipEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessRelationshipDispute" (
    "id" TEXT NOT NULL,
    "businessRelationshipId" TEXT NOT NULL,
    "raisedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessRelationshipDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringProgram" (
    "id" TEXT NOT NULL,
    "mentorUserId" TEXT NOT NULL,
    "menteeUserId" TEXT NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "focusSkillId" TEXT,
    "goals" JSONB,
    "status" "MentoringProgramStatus" NOT NULL DEFAULT 'PROPOSED',
    "relationshipId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentoringProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateNetwork" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "membershipVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateNetworkMembership" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PrivateNetworkMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "status" "PrivateNetworkMembershipStatus" NOT NULL DEFAULT 'INVITED',
    "invitedByUserId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateNetworkMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipNetworkLink" (
    "relationshipId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationshipNetworkLink_pkey" PRIMARY KEY ("relationshipId","networkId")
);

-- CreateIndex
CREATE INDEX "RelationshipProjectLink_portfolioItemId_idx" ON "RelationshipProjectLink"("portfolioItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RelationshipProjectLink_relationshipId_portfolioItemId_key" ON "RelationshipProjectLink"("relationshipId", "portfolioItemId");

-- CreateIndex
CREATE INDEX "BusinessRelationship_partyAUserId_idx" ON "BusinessRelationship"("partyAUserId");

-- CreateIndex
CREATE INDEX "BusinessRelationship_partyABusinessId_idx" ON "BusinessRelationship"("partyABusinessId");

-- CreateIndex
CREATE INDEX "BusinessRelationship_partyBUserId_idx" ON "BusinessRelationship"("partyBUserId");

-- CreateIndex
CREATE INDEX "BusinessRelationship_partyBBusinessId_idx" ON "BusinessRelationship"("partyBBusinessId");

-- CreateIndex
CREATE INDEX "BusinessRelationshipEvidence_businessRelationshipId_idx" ON "BusinessRelationshipEvidence"("businessRelationshipId");

-- CreateIndex
CREATE INDEX "BusinessRelationshipDispute_businessRelationshipId_idx" ON "BusinessRelationshipDispute"("businessRelationshipId");

-- CreateIndex
CREATE INDEX "MentoringProgram_mentorUserId_status_idx" ON "MentoringProgram"("mentorUserId", "status");

-- CreateIndex
CREATE INDEX "MentoringProgram_menteeUserId_status_idx" ON "MentoringProgram"("menteeUserId", "status");

-- CreateIndex
CREATE INDEX "PrivateNetwork_createdByUserId_idx" ON "PrivateNetwork"("createdByUserId");

-- CreateIndex
CREATE INDEX "PrivateNetworkMembership_userId_status_idx" ON "PrivateNetworkMembership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateNetworkMembership_networkId_userId_key" ON "PrivateNetworkMembership"("networkId", "userId");

-- AddForeignKey
ALTER TABLE "RelationshipProjectLink" ADD CONSTRAINT "RelationshipProjectLink_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipProjectLink" ADD CONSTRAINT "RelationshipProjectLink_portfolioItemId_fkey" FOREIGN KEY ("portfolioItemId") REFERENCES "PortfolioItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipProjectLink" ADD CONSTRAINT "RelationshipProjectLink_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationship" ADD CONSTRAINT "BusinessRelationship_partyAUserId_fkey" FOREIGN KEY ("partyAUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationship" ADD CONSTRAINT "BusinessRelationship_partyABusinessId_fkey" FOREIGN KEY ("partyABusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationship" ADD CONSTRAINT "BusinessRelationship_partyBUserId_fkey" FOREIGN KEY ("partyBUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationship" ADD CONSTRAINT "BusinessRelationship_partyBBusinessId_fkey" FOREIGN KEY ("partyBBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationship" ADD CONSTRAINT "BusinessRelationship_declaredByUserId_fkey" FOREIGN KEY ("declaredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationshipParticipantVisibility" ADD CONSTRAINT "BusinessRelationshipParticipantVisibility_businessRelation_fkey" FOREIGN KEY ("businessRelationshipId") REFERENCES "BusinessRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationshipParticipantVisibility" ADD CONSTRAINT "BusinessRelationshipParticipantVisibility_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationshipEvidence" ADD CONSTRAINT "BusinessRelationshipEvidence_businessRelationshipId_fkey" FOREIGN KEY ("businessRelationshipId") REFERENCES "BusinessRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationshipEvidence" ADD CONSTRAINT "BusinessRelationshipEvidence_portfolioItemId_fkey" FOREIGN KEY ("portfolioItemId") REFERENCES "PortfolioItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationshipEvidence" ADD CONSTRAINT "BusinessRelationshipEvidence_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationshipDispute" ADD CONSTRAINT "BusinessRelationshipDispute_businessRelationshipId_fkey" FOREIGN KEY ("businessRelationshipId") REFERENCES "BusinessRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRelationshipDispute" ADD CONSTRAINT "BusinessRelationshipDispute_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringProgram" ADD CONSTRAINT "MentoringProgram_mentorUserId_fkey" FOREIGN KEY ("mentorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringProgram" ADD CONSTRAINT "MentoringProgram_menteeUserId_fkey" FOREIGN KEY ("menteeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringProgram" ADD CONSTRAINT "MentoringProgram_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringProgram" ADD CONSTRAINT "MentoringProgram_focusSkillId_fkey" FOREIGN KEY ("focusSkillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringProgram" ADD CONSTRAINT "MentoringProgram_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateNetwork" ADD CONSTRAINT "PrivateNetwork_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateNetworkMembership" ADD CONSTRAINT "PrivateNetworkMembership_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "PrivateNetwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateNetworkMembership" ADD CONSTRAINT "PrivateNetworkMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateNetworkMembership" ADD CONSTRAINT "PrivateNetworkMembership_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipNetworkLink" ADD CONSTRAINT "RelationshipNetworkLink_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipNetworkLink" ADD CONSTRAINT "RelationshipNetworkLink_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "PrivateNetwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipNetworkLink" ADD CONSTRAINT "RelationshipNetworkLink_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
