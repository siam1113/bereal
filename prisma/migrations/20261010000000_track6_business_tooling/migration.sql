-- CreateEnum
CREATE TYPE "BusinessAnalyticsEventType" AS ENUM ('STOREFRONT_VIEW');

-- AlterTable
ALTER TABLE "BusinessMembership" ADD COLUMN     "verificationClaimId" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BusinessAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "BusinessAnalyticsEventType" NOT NULL,
    "viewerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessAnalyticsEvent_businessId_type_createdAt_idx" ON "BusinessAnalyticsEvent"("businessId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMembership_verificationClaimId_key" ON "BusinessMembership"("verificationClaimId");

-- AddForeignKey
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_verificationClaimId_fkey" FOREIGN KEY ("verificationClaimId") REFERENCES "CredentialClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAnalyticsEvent" ADD CONSTRAINT "BusinessAnalyticsEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

