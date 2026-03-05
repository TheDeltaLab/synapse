/*
  Warnings:

  - You are about to drop the column `tokens` on the `request_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "request_logs" DROP COLUMN "tokens",
ADD COLUMN     "cacheTtl" INTEGER,
ADD COLUMN     "cacheType" TEXT,
ADD COLUMN     "contentIv" BYTEA,
ADD COLUMN     "contentTag" BYTEA,
ADD COLUMN     "costSaving" DOUBLE PRECISION,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "latencySaving" INTEGER,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "promptContent" BYTEA,
ADD COLUMN     "responseContent" BYTEA,
ADD COLUMN     "totalTokens" INTEGER;

-- CreateIndex
CREATE INDEX "request_logs_createdAt_idx" ON "request_logs"("createdAt");

-- CreateIndex
CREATE INDEX "request_logs_cached_idx" ON "request_logs"("cached");
