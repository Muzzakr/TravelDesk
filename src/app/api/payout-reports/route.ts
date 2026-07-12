import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'
import { z } from 'zod'

const MarkPersonPaidSchema = z.object({ employeeId: z.string().min(1) })

const ALLOWED_ROLES = ['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN']

// Per-person payout view: who is owed what right now.
export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const companyId = session.user.companyId

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [outstanding, paidThisMonth] = await Promise.all([
    prisma.expense.findMany({
      where: { companyId, status: 'APPROVED' },
      select: {
        id: true,
        amountUsd: true,
        category: true,
        description: true,
        merchantName: true,
        transactionDate: true,
        createdAt: true,
        employee: { select: { id: true, name: true } },
        event: { select: { eventName: true, eventCode: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // "Paid this month" approximated by the status flip timestamp (updatedAt)
    prisma.expense.groupBy({
      by: ['employeeId'],
      where: { companyId, status: 'PAID', updatedAt: { gte: monthStart } },
      _sum: { amountUsd: true },
    }),
  ])

  const paidMap: Record<string, number> = {}
  for (const row of paidThisMonth) {
    paidMap[row.employeeId] = Number(row._sum.amountUsd ?? 0)
  }

  const byPerson: Record<string, {
    employeeId: string; name: string; count: number; totalUsd: number; paidThisMonthUsd: number
    expenses: { id: string; amountUsd: number; category: string; description: string; merchantName: string | null; transactionDate: string | null; eventName: string; eventCode: string }[]
  }> = {}

  for (const e of outstanding) {
    const id = e.employee.id
    if (!byPerson[id]) {
      byPerson[id] = {
        employeeId: id, name: e.employee.name,
        count: 0, totalUsd: 0, paidThisMonthUsd: paidMap[id] ?? 0,
        expenses: [],
      }
    }
    byPerson[id].count++
    byPerson[id].totalUsd += Number(e.amountUsd)
    byPerson[id].expenses.push({
      id: e.id,
      amountUsd: Number(e.amountUsd),
      category: e.category as string,
      description: e.description,
      merchantName: e.merchantName,
      transactionDate: e.transactionDate ? e.transactionDate.toISOString() : null,
      eventName: e.event.eventName,
      eventCode: e.event.eventCode,
    })
  }

  const people = Object.values(byPerson)
    .map((p) => ({ ...p, totalUsd: Math.round(p.totalUsd * 100) / 100, paidThisMonthUsd: Math.round(p.paidThisMonthUsd * 100) / 100 }))
    .sort((a, b) => b.totalUsd - a.totalUsd)

  const totalOutstandingUsd = Math.round(people.reduce((s, p) => s + p.totalUsd, 0) * 100) / 100

  return NextResponse.json({ people, totalOutstandingUsd })
}

// Mark every approved expense for one employee as paid.
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const companyId = session.user.companyId

  const body = await req.json()
  const parsed = MarkPersonPaidSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { employeeId } = parsed.data

  const approved = await prisma.expense.findMany({
    where: { companyId, employeeId, status: 'APPROVED' },
    select: { id: true, amountUsd: true },
  })
  if (approved.length === 0) {
    return NextResponse.json({ error: 'No approved expenses to pay out for this employee' }, { status: 409 })
  }
  const totalUsd = Math.round(approved.reduce((s, e) => s + Number(e.amountUsd), 0) * 100) / 100

  await prisma.expense.updateMany({
    where: { companyId, employeeId, status: 'APPROVED' },
    data: { status: 'PAID' },
  })

  await writeAuditLog({
    companyId,
    actorId: session.user.id,
    action: 'EXPENSES_MARKED_PAID_BULK',
    entityType: 'User',
    entityId: employeeId,
    payload: { employeeId, count: approved.length, totalUsd },
  })

  await createNotification({
    companyId,
    userId: employeeId,
    type: 'expense_paid',
    title: 'Your expenses were paid',
    description: `${approved.length} expense${approved.length > 1 ? 's' : ''} · $${totalUsd.toFixed(2)}`,
    href: '/employee/expenses',
  })

  return NextResponse.json({ success: true, count: approved.length, totalUsd })
}
