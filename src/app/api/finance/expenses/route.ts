import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'TRAVEL_MANAGER'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId
  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get('month') ?? ''
  const month = parseInt(monthParam)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const allMonths = !monthParam || monthParam === '0'
  const status = searchParams.get('status') ?? ''
  const employeeId = searchParams.get('employeeId') ?? ''
  const search = searchParams.get('search') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 10

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const where: Record<string, unknown> = {
    companyId,
    ...(!allMonths && { createdAt: { gte: start, lte: end } }),
  }
  if (status) where.status = status
  if (employeeId) where.employeeId = employeeId
  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { merchantName: { contains: search, mode: 'insensitive' } },
      { employee: { name: { contains: search, mode: 'insensitive' } } },
      { event: { eventName: { contains: search, mode: 'insensitive' } } },
    ]
  }

  // KPI stats aggregated in the database instead of scanning every row in JS
  const periodWhere = { companyId, ...(!allMonths && { createdAt: { gte: start, lte: end } }) }

  const [expenses, total, statusGroups, categoryGroups, processedExpenses] = await Promise.all([
    prisma.expense.findMany({
      where: where as never,
      include: {
        employee: { select: { id: true, name: true } },
        event: { select: { eventCode: true, eventName: true } },
        receipts: { select: { id: true, fileName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expense.count({ where: where as never }),
    prisma.expense.groupBy({
      by: ['status'],
      where: periodWhere,
      _sum: { amountUsd: true },
      _count: true,
    }),
    prisma.expense.groupBy({
      by: ['category'],
      where: periodWhere,
      _sum: { amountUsd: true },
    }),
    // Only processed rows, only the two timestamps — for avg processing time
    prisma.expense.findMany({
      where: { ...periodWhere, status: { in: ['APPROVED', 'PAID'] } },
      select: { createdAt: true, updatedAt: true },
    }),
  ])

  const amountFor = (statuses: string[]) =>
    statusGroups.filter((g) => statuses.includes(g.status)).reduce((s, g) => s + Number(g._sum.amountUsd ?? 0), 0)
  const countFor = (statuses: string[]) =>
    statusGroups.filter((g) => statuses.includes(g.status)).reduce((s, g) => s + g._count, 0)
  const allStatuses = statusGroups.map((g) => g.status)

  // Average processing time (submitted → approved/paid, in days)
  const avgProcessingTime = processedExpenses.length > 0
    ? processedExpenses.reduce((s, e) => {
        const diff = (e.updatedAt.getTime() - e.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        return s + diff
      }, 0) / processedExpenses.length
    : 0

  // Category breakdown for bar chart (null categories fold into OTHER)
  const categoryCounts: Record<string, number> = {}
  categoryGroups.forEach((g) => {
    const cat = g.category ?? 'OTHER'
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + Number(g._sum.amountUsd ?? 0)
  })

  // 72h escalation: expenses pending > 72 hours
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000)
  const escalatedCount = await prisma.expense.count({
    where: {
      companyId,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
      createdAt: { lte: cutoff },
    },
  })

  // Employees list for filter dropdown
  const employees = await prisma.user.findMany({
    where: { companyId, role: 'EMPLOYEE' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    userRole: session.user.role,
    expenses,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    kpis: {
      awaitingPaymentAmount: amountFor(['APPROVED']),
      awaitingPaymentCount: countFor(['APPROVED']),
      paidThisMonthAmount: amountFor(['PAID']),
      paidThisMonthCount: countFor(['PAID']),
      pendingManagerReviewAmount: amountFor(['SUBMITTED', 'UNDER_REVIEW']),
      pendingManagerReviewCount: countFor(['SUBMITTED', 'UNDER_REVIEW']),
      totalExpensesAmount: amountFor(allStatuses),
      totalExpensesCount: countFor(allStatuses),
      avgProcessingDays: Math.round(avgProcessingTime * 10) / 10,
    },
    charts: {
      statusDistribution: statusGroups.map((g) => ({
        status: g.status,
        count: g._count,
        amount: Number(g._sum.amountUsd ?? 0),
      })),
      categoryBreakdown: Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([category, amount]) => ({ category, amount })),
    },
    escalatedCount,
    employees,
  })
}
