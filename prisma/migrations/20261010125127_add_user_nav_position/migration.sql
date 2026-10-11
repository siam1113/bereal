-- CreateEnum
CREATE TYPE "NavPosition" AS ENUM ('LEFT', 'RIGHT', 'TOP', 'BOTTOM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "navPosition" "NavPosition" NOT NULL DEFAULT 'LEFT';
