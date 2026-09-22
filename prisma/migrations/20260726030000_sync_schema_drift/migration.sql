-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('INVITE', 'PASSWORD_RESET', 'GOOGLE_VERIFY', 'EMAIL_VERIFY', 'MAGIC_LINK');

-- CreateEnum
CREATE TYPE "InboxChannel" AS ENUM ('TRAVEL_CARS', 'TRAVEL_FLIGHTS', 'TRAVEL_HOTELS');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'IGNORED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TRAVEL_MANAGER';

-- AlterEnum
ALTER TYPE "TravelRequestStatus" ADD VALUE 'PENDING_ADMIN';

-- DropForeignKey
ALTER TABLE "Delegation" DROP CONSTRAINT "Delegation_delegateId_fkey";

-- DropForeignKey
ALTER TABLE "Delegation" DROP CONSTRAINT "Delegation_delegatorId_fkey";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "webhookApiKey" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "address" TEXT,
ADD COLUMN     "assignedDj" TEXT,
ADD COLUMN     "assignedMc" TEXT,
ADD COLUMN     "eventDate" TIMESTAMP(3),
ADD COLUMN     "salesPerson" TEXT,
ADD COLUMN     "service" TEXT,
ADD COLUMN     "timing" TEXT,
ADD COLUMN     "venue" TEXT,
ALTER COLUMN "costCenter" DROP NOT NULL,
ALTER COLUMN "budgetUsd" SET DEFAULT 0,
ALTER COLUMN "dateStart" DROP NOT NULL,
ALTER COLUMN "dateEnd" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "personName" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "service" TEXT;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "fileData" BYTEA,
ALTER COLUMN "s3Key" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TravelRequest" ADD COLUMN     "adminEscalationNote" TEXT,
ADD COLUMN     "approvedServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "confirmationDocUrl" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "rejectedServices" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "Delegation";

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaBackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaBackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingConfirmation" (
    "id" TEXT NOT NULL,
    "travelRequestId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "confirmationNumber" TEXT,
    "notes" TEXT,
    "fileName" TEXT,
    "fileData" BYTEA,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelInboxMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channel" "InboxChannel" NOT NULL,
    "slackUserId" TEXT,
    "slackUserName" TEXT,
    "slackMsgTs" TEXT,
    "slackThreadTs" TEXT,
    "slackChannelId" TEXT,
    "rawText" TEXT NOT NULL,
    "parsedData" JSONB,
    "status" "InboxStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "travelRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelInboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "passportNumber" TEXT,
    "passportIssueDate" TIMESTAMP(3),
    "passportExpiry" TIMESTAMP(3),
    "passportPhotoKey" TEXT,
    "driversLicenseNumber" TEXT,
    "driversLicenseIssueDate" TIMESTAMP(3),
    "driversLicenseExpiry" TIMESTAMP(3),
    "driversLicensePhotoKey" TEXT,
    "ktnNumber" TEXT,
    "globalEntryNumber" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    "contactEmail" TEXT,
    "homeAddress" TEXT,
    "profilePhotoKey" TEXT,
    "airlineAccounts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE INDEX "MfaBackupCode_userId_idx" ON "MfaBackupCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TravelerProfile_userId_key" ON "TravelerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_webhookApiKey_key" ON "Company"("webhookApiKey");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaBackupCode" ADD CONSTRAINT "MfaBackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingConfirmation" ADD CONSTRAINT "BookingConfirmation_travelRequestId_fkey" FOREIGN KEY ("travelRequestId") REFERENCES "TravelRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelInboxMessage" ADD CONSTRAINT "TravelInboxMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelInboxMessage" ADD CONSTRAINT "TravelInboxMessage_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelerProfile" ADD CONSTRAINT "TravelerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelerProfile" ADD CONSTRAINT "TravelerProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

