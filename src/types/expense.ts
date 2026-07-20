export type ExpenseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'PENDING_ADMIN'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID'

export type ExpenseCategory =
  | 'MEALS'
  | 'TRANSPORT'
  | 'ACCOMMODATION'
  | 'SUPPLIES'
  | 'OTHER'

export type ExpenseType = 'OUT_OF_POCKET' | 'CORPORATE_CARD'

export interface Expense {
  id: string
  companyId: string
  employeeId: string
  eventId: string
  travelRequestId: string | null
  category: ExpenseCategory
  expenseType: ExpenseType
  amountUsd: number
  currency: string
  description: string
  status: ExpenseStatus
  merchantName: string | null
  transactionDate: Date | null
  rejectionNote: string | null
  payoutReportId: string | null
  createdAt: Date
  updatedAt: Date
  receipts?: { id: string; fileName: string }[]
}

export interface CreateExpenseInput {
  eventId: string
  travelRequestId?: string
  category: ExpenseCategory
  expenseType?: ExpenseType
  amountUsd: number
  currency?: string
  description: string
  merchantName?: string
  transactionDate?: string
}

export interface PolicyFlag {
  type: 'MISSING_RECEIPT' | 'AMOUNT_THRESHOLD' | 'CATEGORY_POLICY' | 'BUDGET_CAP'
  message: string
  severity: 'WARNING' | 'BLOCK'
}
