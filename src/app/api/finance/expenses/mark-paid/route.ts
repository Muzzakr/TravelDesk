import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { expenseId } = await req.json()
  if (!expenseId) return NextResponse.json({ error: 'expenseId required' }, { status: 400 })

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, companyId: session.user.companyId },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (expense.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Only approved expenses can be marked as paid' }, { status: 400 })
  }

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: { status: 'PAID' },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'EXPENSE_MARKED_PAID',
    entityType: 'Expense',
    entityId: expenseId,
    payload: { amount: Number(expense.amountUsd) },
  })

  await createNotification({
    companyId: session.user.companyId,
    userId: expense.employeeId,
    type: 'expense_paid',
    title: 'Your expense was paid',
    description: `${expense.description} · $${Number(expense.amountUsd).toFixed(2)}`,
    href: `/employee/expenses/${expenseId}`,
  })

  return NextResponse.json(updated)
}
