-- TravelDesk full schema — paste into Supabase SQL Editor and click Run

-- Enums
CREATE TYPE "Role" AS ENUM ('EMPLOYEE','MANAGER','TRAVEL_AGENT','FINANCE_ADMIN','SYSTEM_ADMIN');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT','ACTIVE','CLOSED');
CREATE TYPE "TravelRequestStatus" AS ENUM ('DRAFT','SUBMITTED','PENDING_AGENT','PENDING_MANAGER','OPTIONS_PROVIDED','APPROVED','BOOKING_CONFIRMED','REJECTED','CANCELLED');
CREATE TYPE "RoutingPath" AS ENUM ('AGENT_FIRST','MANAGER_FIRST','PARALLEL','MANAGER_ONLY');
CREATE TYPE "TravelClass" AS ENUM ('ECONOMY','BUSINESS','FIRST');
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID');
CREATE TYPE "ExpenseCategory" AS ENUM ('MEALS','TRANSPORT','ACCOMMODATION','SUPPLIES','OTHER');
CREATE TYPE "ExpenseType" AS ENUM ('OUT_OF_POCKET','CORPORATE_CARD');
CREATE TYPE "ApprovalActionType" AS ENUM ('APPROVE','REJECT','DELEGATE','ESCALATE','MODIFY','SUBMIT');
CREATE TYPE "CardTransactionStatus" AS ENUM ('PENDING_TAG','TAGGED','SUBMITTED','MATCHED');
CREATE TYPE "PayoutReportStatus" AS ENUM ('GENERATED','FINANCE_REVIEWED','PAID','EXPORTED');
CREATE TYPE "PolicyRuleType" AS ENUM ('AMOUNT_THRESHOLD','CATEGORY_POLICY','MISSING_RECEIPT','EVENT_BUDGET_CAP');

-- Company
CREATE TABLE "Company" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'starter',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Company_slug_key" UNIQUE ("slug")
);

-- User
CREATE TABLE "User" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
  "passwordHash" TEXT,
  "mfaSecret" TEXT,
  "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  "managerId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_companyId_email_key" UNIQUE ("companyId","email")
);

-- Delegation
CREATE TABLE "Delegation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "delegatorId" TEXT NOT NULL,
  "delegateId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- Event
CREATE TABLE "Event" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "eventCode" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "costCenter" TEXT NOT NULL,
  "budgetUsd" DECIMAL(12,2) NOT NULL,
  "approvedSpendUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "dateStart" TIMESTAMP(3) NOT NULL,
  "dateEnd" TIMESTAMP(3) NOT NULL,
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "ownerUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Event_companyId_eventCode_key" UNIQUE ("companyId","eventCode")
);

-- TravelRequest
CREATE TABLE "TravelRequest" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "agentId" TEXT,
  "eventId" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "travelDates" JSONB NOT NULL,
  "servicesRequested" TEXT[] NOT NULL,
  "estimatedCostUsd" DECIMAL(12,2),
  "purpose" TEXT NOT NULL,
  "preferredClass" "TravelClass" NOT NULL DEFAULT 'ECONOMY',
  "hotelNights" INTEGER,
  "carRentalDays" INTEGER,
  "specialInstructions" TEXT,
  "status" "TravelRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "routingPath" "RoutingPath" NOT NULL DEFAULT 'AGENT_FIRST',
  "rejectionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelRequest_pkey" PRIMARY KEY ("id")
);

-- Expense
CREATE TABLE "Expense" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "travelRequestId" TEXT,
  "category" "ExpenseCategory" NOT NULL,
  "expenseType" "ExpenseType" NOT NULL DEFAULT 'OUT_OF_POCKET',
  "amountUsd" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "description" TEXT NOT NULL,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
  "merchantName" TEXT,
  "transactionDate" TIMESTAMP(3),
  "rejectionNote" TEXT,
  "payoutReportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- Receipt
CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "expenseId" TEXT NOT NULL,
  "s3Key" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "ocrMerchant" TEXT,
  "ocrAmount" DECIMAL(12,2),
  "ocrDate" TIMESTAMP(3),
  "ocrRaw" JSONB,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- ApprovalAction
CREATE TABLE "ApprovalAction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "travelRequestId" TEXT,
  "expenseId" TEXT,
  "actionType" "ApprovalActionType" NOT NULL,
  "note" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- Comment
CREATE TABLE "Comment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "expenseId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CardTransaction
CREATE TABLE "CardTransaction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT,
  "transactionId" TEXT NOT NULL,
  "merchant" TEXT NOT NULL,
  "amountUsd" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "mccCode" TEXT,
  "cardProgram" TEXT NOT NULL,
  "eventId" TEXT,
  "status" "CardTransactionStatus" NOT NULL DEFAULT 'PENDING_TAG',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardTransaction_transactionId_key" UNIQUE ("transactionId")
);

-- AuditLog
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- PayoutReport
CREATE TABLE "PayoutReport" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "PayoutReportStatus" NOT NULL DEFAULT 'GENERATED',
  "totalUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "exportedAt" TIMESTAMP(3),
  CONSTRAINT "PayoutReport_pkey" PRIMARY KEY ("id")
);

-- PolicyRule
CREATE TABLE "PolicyRule" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "ruleType" "PolicyRuleType" NOT NULL,
  "config" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id");
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegatorId_fkey" FOREIGN KEY ("delegatorId") REFERENCES "User"("id");
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id");
ALTER TABLE "Event" ADD CONSTRAINT "Event_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id");
ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id");
ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_travelRequestId_fkey" FOREIGN KEY ("travelRequestId") REFERENCES "TravelRequest"("id");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payoutReportId_fkey" FOREIGN KEY ("payoutReportId") REFERENCES "PayoutReport"("id");
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE;
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id");
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_travelRequestId_fkey" FOREIGN KEY ("travelRequestId") REFERENCES "TravelRequest"("id");
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id");
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE;
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id");
ALTER TABLE "PayoutReport" ADD CONSTRAINT "PayoutReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
ALTER TABLE "PolicyRule" ADD CONSTRAINT "PolicyRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;

-- Prisma migrations table (required)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
