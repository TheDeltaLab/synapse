-- AlterTable
ALTER TABLE "embedding_logs"
    ADD COLUMN "cached" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "cacheType" TEXT,
    ADD COLUMN "cacheTtl" INTEGER;

-- CreateIndex
CREATE INDEX "embedding_logs_cached_idx" ON "embedding_logs"("cached");
