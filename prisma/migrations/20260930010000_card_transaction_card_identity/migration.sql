-- AlterTable
ALTER TABLE "CardTransaction" ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "cardLastFour" TEXT;

-- CreateIndex
CREATE INDEX "CardTransaction_companyId_cardId_cardLastFour_idx" ON "CardTransaction"("companyId", "cardId", "cardLastFour");

