import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Company-wide spend data — approval/finance roles only
  if (!['MANAGER', 'TRAVEL_MANAGER', 'FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const [travel, expenses] = await Promise.all([
    prisma.travelRequest.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      include: {
        employee: { select: { name: true } },
        event: { select: { eventName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      include: {
        employee: { select: { name: true } },
        event: { select: { eventName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const travelRows = travel.map((r) => ({
    id: r.id,
    employee: r.employee.name,
    origin: r.origin,
    destination: r.destination,
    status: r.status,
    estimatedCostUsd: r.estimatedCostUsd ? Number(r.estimatedCostUsd) : null,
    createdAt: r.createdAt.toISOString(),
    event: r.event.eventName,
  }))

  const expenseRows = expenses.map((e) => ({
    id: e.id,
    employee: e.employee.name,
    description: e.description,
    category: e.category ?? '',
    amountUsd: Number(e.amountUsd),
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    event: e.event.eventName,
  }))

  const approvedTravel = travel.filter((r) => ['APPROVED', 'BOOKING_CONFIRMED'].includes(r.status)).length
  const approvedExpenses = expenses.filter((e) => ['APPROVED', 'PAID'].includes(e.status)).length
  const totalSpend = expenses
    .filter((e) => ['APPROVED', 'PAID'].includes(e.status))
    .reduce((s, e) => s + Number(e.amountUsd), 0)

  return NextResponse.json({
    travel: travelRows,
    expenses: expenseRows,
    summary: {
      totalTravel: travel.length,
      totalExpenses: expenses.length,
      approvedTravel,
      approvedExpenses,
      rejectedTravel: travel.filter((r) => r.status === 'REJECTED').length,
      rejectedExpenses: expenses.filter((e) => e.status === 'REJECTED').length,
      totalSpend,
    },
  })
}
