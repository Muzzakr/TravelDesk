-- AlterTable
ALTER TABLE "TravelRequest" ADD COLUMN     "confirmationNumber" TEXT;

-- CreateTable
CREATE TABLE "BookingOption" (
    "id" TEXT NOT NULL,
    "travelRequestId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceUsd" DECIMAL(12,2) NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingOption_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BookingOption" ADD CONSTRAINT "BookingOption_travelRequestId_fkey" FOREIGN KEY ("travelRequestId") REFERENCES "TravelRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
