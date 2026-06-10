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
  const status = searchParams.get('status') ?? ''
  const employeeId = searchParams.get('employeeId') ?? ''
  const search = searchParams.get('search') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 10

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const where: Record<string, unknown> = {
    companyId,
    createdAt: { gte: start, lte: end },
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

  const [expenses, total, allExpenses] = await Promise.all([
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
    // All expenses this month (unfiltered) for KPI stats
    prisma.expense.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { id: true, status: true, amountUsd: true, createdAt: true, updatedAt: true, category: true },
    }),
  ])

  // KPI calculations
  const awaitingPayment = allExpenses.filter((e) => e.status === 'APPROVED')
  const paidThisMonth = allExpenses.filter((e) => e.status === 'PAID')
  const pendingManagerReview = allExpenses.filter((e) => ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status))
  const allThisMonth = allExpenses

  // Average processing time (submitted → approved/paid, in days)
  const processedExpenses = allExpenses.filter((e) => ['APPROVED', 'PAID'].includes(e.status))
  const avgProcessingTime = processedExpenses.length > 0
    ? processedExpenses.reduce((s, e) => {
        const diff = (e.updatedAt.getTime() - e.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        return s + diff
      }, 0) / processedExpenses.length
    : 0

  // Expense status distribution for donut chart
  const statusCounts: Record<string, { count: number; amount: number }> = {}
  allExpenses.forEach((e) => {
    if (!statusCounts[e.status]) statusCounts[e.status] = { count: 0, amount: 0 }
    statusCounts[e.status].count++
    statusCounts[e.status].amount += Number(e.amountUsd)
  })

  // Category breakdown for bar chart
  const categoryCounts: Record<string, number> = {}
  allExpenses.forEach((e) => {
    const cat = e.category ?? 'OTHER'
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + Number(e.amountUsd)
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
    expenses,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    kpis: {
      awaitingPaymentAmount: awaitingPayment.reduce((s, e) => s + Number(e.amountUsd), 0),
      awaitingPaymentCount: awaitingPayment.length,
      paidThisMonthAmount: paidThisMonth.reduce((s, e) => s + Number(e.amountUsd), 0),
      paidThisMonthCount: paidThisMonth.length,
      pendingManagerReviewAmount: pendingManagerReview.reduce((s, e) => s + Number(e.amountUsd), 0),
      pendingManagerReviewCount: pendingManagerReview.length,
      totalExpensesAmount: allThisMonth.reduce((s, e) => s + Number(e.amountUsd), 0),
      totalExpensesCount: allThisMonth.length,
      avgProcessingDays: Math.round(avgProcessingTime * 10) / 10,
    },
    charts: {
      statusDistribution: Object.entries(statusCounts).map(([status, data]) => ({
        status,
        count: data.count,
        amount: data.amount,
      })),
      categoryBreakdown: Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([category, amount]) => ({ category, amount })),
    },
    escalatedCount,
    employees,
  })
}
