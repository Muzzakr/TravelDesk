import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
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

  const [expenses, total, allExpenses, employees] = await Promise.all([
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
    prisma.expense.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { status: true, amountUsd: true },
    }),
    prisma.user.findMany({
      where: { companyId, role: 'EMPLOYEE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const pending = allExpenses.filter((e) => ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status))
  const approved = allExpenses.filter((e) => e.status === 'APPROVED')
  const rejected = allExpenses.filter((e) => e.status === 'REJECTED')

  return NextResponse.json({
    expenses,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    kpis: {
      totalAmount: allExpenses.reduce((s, e) => s + Number(e.amountUsd), 0),
      totalCount: allExpenses.length,
      pendingAmount: pending.reduce((s, e) => s + Number(e.amountUsd), 0),
      pendingCount: pending.length,
      approvedAmount: approved.reduce((s, e) => s + Number(e.amountUsd), 0),
      approvedCount: approved.length,
      rejectedCount: rejected.length,
    },
    employees,
  })
}
