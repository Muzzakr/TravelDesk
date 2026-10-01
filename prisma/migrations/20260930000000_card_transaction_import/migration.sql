-- CreateEnum
CREATE TYPE "CardTransactionReviewType" AS ENUM ('AMOUNT_MISMATCH', 'MISSING_IN_STATEMENT');

-- CreateEnum
CREATE TYPE "CardTransactionReviewStatus" AS ENUM ('PENDING', 'RESOLVED');

-- AlterTable
ALTER TABLE "CardTransaction" ADD COLUMN     "category" TEXT,
ADD COLUMN     "receiptKey" TEXT,
ADD COLUMN     "vehicle" TEXT;

-- CreateTable
CREATE TABLE "CardMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardLastFour" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTransactionReview" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cardTransactionId" TEXT NOT NULL,
    "type" "CardTransactionReviewType" NOT NULL,
    "incomingAmountUsd" DECIMAL(12,2),
    "incomingMerchant" TEXT,
    "incomingCategory" TEXT,
    "status" "CardTransactionReviewStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardTransactionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardMapping_companyId_cardId_cardLastFour_key" ON "CardMapping"("companyId", "cardId", "cardLastFour");

-- CreateIndex
CREATE INDEX "CardTransactionReview_companyId_status_idx" ON "CardTransactionReview"("companyId", "status");

-- AddForeignKey
ALTER TABLE "CardMapping" ADD CONSTRAINT "CardMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardMapping" ADD CONSTRAINT "CardMapping_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransactionReview" ADD CONSTRAINT "CardTransactionReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransactionReview" ADD CONSTRAINT "CardTransactionReview_cardTransactionId_fkey" FOREIGN KEY ("cardTransactionId") REFERENCES "CardTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransactionReview" ADD CONSTRAINT "CardTransactionReview_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

