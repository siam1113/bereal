-- CreateEnum
CREATE TYPE "ReferenceStatus" AS ENUM ('SUBMITTED', 'DISPUTED', 'REVOKED');

-- AlterTable
ALTER TABLE "BadgeAward" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CredentialClaim" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedReason" TEXT;

-- CreateTable
CREATE TABLE "ClaimAppeal" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "raisedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ClaimAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "comment" TEXT,
    "status" "ReferenceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceDispute" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "raisedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReferenceDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaimAppeal_claimId_idx" ON "ClaimAppeal"("claimId");

-- CreateIndex
CREATE INDEX "Reference_subjectUserId_status_idx" ON "Reference"("subjectUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Reference_authorUserId_subjectUserId_relationshipId_key" ON "Reference"("authorUserId", "subjectUserId", "relationshipId");

-- CreateIndex
CREATE INDEX "ReferenceDispute_referenceId_idx" ON "ReferenceDispute"("referenceId");

-- AddForeignKey
ALTER TABLE "ClaimAppeal" ADD CONSTRAINT "ClaimAppeal_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "CredentialClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAppeal" ADD CONSTRAINT "ClaimAppeal_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceDispute" ADD CONSTRAINT "ReferenceDispute_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceDispute" ADD CONSTRAINT "ReferenceDispute_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
