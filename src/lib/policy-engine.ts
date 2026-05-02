import { prisma } from './prisma'
import type { PolicyFlag } from '@/types/expense'

interface ExpensePolicyInput {
  companyId: string
  eventId: string
  amountUsd: number
  category: string
  hasReceipt: boolean
}

interface TravelBudgetCheckResult {
  withinBudget: boolean
  warningTriggered: boolean
  budgetExceeded: boolean
  remainingUsd: number
}

export async function checkExpensePolicy(
  input: ExpensePolicyInput
): Promise<PolicyFlag[]> {
  const flags: PolicyFlag[] = []
  const rules = await prisma.policyRule.findMany({
    where: { companyId: input.companyId, isActive: true },
  })

  for (const rule of rules) {
    const config = rule.config as Record<string, unknown>

    if (rule.ruleType === 'MISSING_RECEIPT') {
      const min = (config.minimumAmountUsd as number) ?? 25
      if (!input.hasReceipt && input.amountUsd >= min) {
        flags.push({
          type: 'MISSING_RECEIPT',
          message: `Receipt required for expenses over $${min}`,
          severity: 'BLOCK',
        })
      }
    }

    if (rule.ruleType === 'AMOUNT_THRESHOLD') {
      const threshold = (config.thresholdUsd as number) ?? 500
      if (input.amountUsd > threshold) {
        flags.push({
          type: 'AMOUNT_THRESHOLD',
          message: `Amount exceeds $${threshold} — Finance Admin approval required`,
          severity: 'WARNING',
        })
      }
    }

    if (rule.ruleType === 'CATEGORY_POLICY') {
      const blocked = (config.blockedCategories as string[]) ?? []
      const flagged = (config.flaggedCategories as string[]) ?? []
      if (blocked.includes(input.category)) {
        flags.push({
          type: 'CATEGORY_POLICY',
          message: `Category "${input.category}" requires Finance Admin approval`,
          severity: 'BLOCK',
        })
      } else if (flagged.includes(input.category)) {
        flags.push({
          type: 'CATEGORY_POLICY',
          message: `Category "${input.category}" is flagged for review`,
          severity: 'WARNING',
        })
      }
    }
  }

  return flags
}

export async function checkEventBudget(
  companyId: string,
  eventId: string,
  additionalUsd: number
): Promise<TravelBudgetCheckResult> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, companyId },
  })

  if (!event) {
    return { withinBudget: false, warningTriggered: false, budgetExceeded: true, remainingUsd: 0 }
  }

  const budget = Number(event.budgetUsd)
  const approved = Number(event.approvedSpendUsd)
  const projected = approved + additionalUsd
  const remaining = budget - approved

  const rules = await prisma.policyRule.findFirst({
    where: { companyId, ruleType: 'EVENT_BUDGET_CAP', isActive: true },
  })
  const config = (rules?.config ?? {}) as Record<string, unknown>
  const warnPct = (config.warningPercent as number) ?? 80
  const blockPct = (config.blockPercent as number) ?? 100

  const withinBudget = projected <= budget
  const warningTriggered = budget > 0 && projected / budget >= warnPct / 100
  const budgetExceeded = budget > 0 && projected / budget >= blockPct / 100

  return {
    withinBudget,
    warningTriggered,
    budgetExceeded,
    remainingUsd: remaining,
  }
}
