-- AlterTable
ALTER TABLE "SourceMarket" ADD COLUMN     "clobTokenIds" JSONB,
ADD COLUMN     "volumeTier" TEXT,
ADD COLUMN     "lastPriceUpdate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SourceMarket_volumeTier_idx" ON "SourceMarket"("volumeTier");

-- CreateIndex
CREATE INDEX "SourceMarket_isActive_idx" ON "SourceMarket"("isActive");

