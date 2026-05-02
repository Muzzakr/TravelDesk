import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const PolicySchema = z.object({
  amountThreshold: z.number().positive(),
  receiptMinimum: z.number().positive(),
  budgetWarningPercent: z.number().min(1).max(100),
  budgetBlockPercent: z.number().min(1).max(100),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId
  const rules = await prisma.policyRule.findMany({
    where: { companyId, isActive: true },
  })

  const get = (type: string, key: string, def: number) => {
    const rule = rules.find((r) => r.ruleType === type)
    return ((rule?.config as Record<string, unknown>)?.[key] as number) ?? def
  }

  return NextResponse.json({
    amountThreshold: get('AMOUNT_THRESHOLD', 'thresholdUsd', 500),
    receiptMinimum: get('MISSING_RECEIPT', 'minimumAmountUsd', 25),
    budgetWarningPercent: get('EVENT_BUDGET_CAP', 'warningPercent', 80),
    budgetBlockPercent: get('EVENT_BUDGET_CAP', 'blockPercent', 100),
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId
  const body = await req.json()
  const parsed = PolicySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { amountThreshold, receiptMinimum, budgetWarningPercent, budgetBlockPercent } = parsed.data

  const upsert = async (ruleType: string, config: Record<string, unknown>) => {
    const existing = await prisma.policyRule.findFirst({ where: { companyId, ruleType } })
    if (existing) {
      await prisma.policyRule.update({ where: { id: existing.id }, data: { config, isActive: true } })
    } else {
      await prisma.policyRule.create({ data: { companyId, ruleType, config, isActive: true } })
    }
  }

  await Promise.all([
    upsert('AMOUNT_THRESHOLD', { thresholdUsd: amountThreshold }),
    upsert('MISSING_RECEIPT', { minimumAmountUsd: receiptMinimum }),
    upsert('EVENT_BUDGET_CAP', { warningPercent: budgetWarningPercent, blockPercent: budgetBlockPercent }),
  ])

  await writeAuditLog({
    companyId,
    actorId: session.user.id,
    action: 'POLICY_UPDATED',
    entityType: 'PolicyRule',
    entityId: companyId,
    payload: parsed.data,
  })

  return NextResponse.json({ success: true })
}
