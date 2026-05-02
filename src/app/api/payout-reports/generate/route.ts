import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const GenerateSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const periodStart = new Date(parsed.data.periodStart)
  const periodEnd = new Date(parsed.data.periodEnd)

  const approvedExpenses = await prisma.expense.findMany({
    where: {
      companyId: session.user.companyId,
      status: 'APPROVED',
      payoutReportId: null,
      updatedAt: { gte: periodStart, lte: periodEnd },
    },
  })

  const totalUsd = approvedExpenses.reduce((sum, e) => sum + Number(e.amountUsd), 0)

  const report = await prisma.payoutReport.create({
    data: {
      companyId: session.user.companyId,
      periodStart,
      periodEnd,
      totalUsd,
      status: 'GENERATED',
    },
  })

  if (approvedExpenses.length > 0) {
    await prisma.expense.updateMany({
      where: { id: { in: approvedExpenses.map((e) => e.id) } },
      data: { payoutReportId: report.id },
    })
  }

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'PAYOUT_REPORT_GENERATED',
    entityType: 'PayoutReport',
    entityId: report.id,
    payload: { periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, totalUsd, expenseCount: approvedExpenses.length },
  })

  return NextResponse.json(report, { status: 201 })
}
