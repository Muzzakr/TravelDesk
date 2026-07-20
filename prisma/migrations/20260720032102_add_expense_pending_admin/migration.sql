-- AlterEnum
ALTER TYPE "ExpenseStatus" ADD VALUE 'PENDING_ADMIN';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "adminEscalationNote" TEXT;
