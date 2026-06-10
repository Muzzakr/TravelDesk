import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const expenses = await prisma.expense.findMany({
    where: { companyId, createdAt: { gte: start, lte: end } },
    include: {
      employee: { select: { name: true } },
      event: { select: { eventName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = expenses.map((e) => ({
    id: e.id,
    employee: e.employee.name,
    description: e.description,
    category: e.category,
    amountUsd: Number(e.amountUsd),
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    event: e.event.eventName,
  }))

  return NextResponse.json({
    expenses: rows,
    summary: {
      totalExpenses: expenses.length,
      totalSpend: expenses.reduce((s, e) => s + Number(e.amountUsd), 0),
      approvedExpenses: expenses.filter((e) => e.status === 'APPROVED').length,
      paidExpenses: expenses.filter((e) => e.status === 'PAID').length,
      pendingExpenses: expenses.filter((e) => ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)).length,
      rejectedExpenses: expenses.filter((e) => e.status === 'REJECTED').length,
    },
  })
}
