-- CreateTable
CREATE TABLE "embedding_logs" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputCount" INTEGER NOT NULL,
    "dimensions" INTEGER,
    "tokens" INTEGER,
    "latency" INTEGER,
    "statusCode" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embedding_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "embedding_logs_apiKeyId_createdAt_idx" ON "embedding_logs"("apiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "embedding_logs_provider_model_idx" ON "embedding_logs"("provider", "model");

-- CreateIndex
CREATE INDEX "embedding_logs_createdAt_idx" ON "embedding_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "embedding_logs" ADD CONSTRAINT "embedding_logs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
