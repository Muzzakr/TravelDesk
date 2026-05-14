import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { notifyExpenseStatusChanged } from '@/lib/notify'
import { emailExpenseApproved, emailExpenseRejected } from '@/lib/mail'
import { z } from 'zod'

const UpdateSchema = z.object({
  status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  rejectionNote: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const expense = await prisma.expense.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: {
      receipts: true,
      approvalActions: { include: { actor: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
      comments: { orderBy: { createdAt: 'asc' } },
      event: true,
      employee: { select: { name: true, email: true } },
    },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const authorIds = [...new Set(expense.comments.map((c) => c.authorId))]
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, name: true },
  })
  const authorMap = Object.fromEntries(authors.map((u) => [u.id, u.name]))
  const enrichedComments = expense.comments.map((c) => ({ ...c, authorName: authorMap[c.authorId] ?? 'Team member' }))

  return NextResponse.json({ ...expense, comments: enrichedComments })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const expense = await prisma.expense.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: { employee: { select: { name: true, email: true } } },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Paid expenses are immutable
  if (expense.status === 'PAID') {
    return NextResponse.json({ error: 'Paid expenses cannot be modified' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (parsed.data.status === 'REJECTED' && !parsed.data.rejectionNote) {
    return NextResponse.json({ error: 'rejectionNote required when rejecting' }, { status: 400 })
  }

  const role = session.user.role ?? ''
  const approverRoles = ['MANAGER', 'FINANCE_ADMIN', 'SYSTEM_ADMIN']

  if (parsed.data.status === 'SUBMITTED') {
    // Only the expense owner can submit their own expense
    if (expense.employeeId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (parsed.data.status === 'APPROVED' || parsed.data.status === 'REJECTED') {
    // Only managers/finance/admin can approve or reject
    if (!approverRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Finance Admin gate: expenses above policy threshold require FINANCE_ADMIN or SYSTEM_ADMIN
  if (parsed.data.status === 'APPROVED') {
    const rule = await prisma.policyRule.findFirst({
      where: { companyId: session.user.companyId, ruleType: 'AMOUNT_THRESHOLD', isActive: true },
    })
    const threshold = ((rule?.config as Record<string, unknown>)?.thresholdUsd as number) ?? 500
    const role = session.user.role ?? ''
    if (Number(expense.amountUsd) > threshold && !['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: `Expenses above $${threshold} require Finance Admin approval` },
        { status: 403 }
      )
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.expense.update({
      where: { id: params.id },
      data: parsed.data,
    })

    // Keep event approvedSpendUsd in sync
    if (parsed.data.status === 'APPROVED' && expense.status !== 'APPROVED') {
      await tx.event.update({
        where: { id: expense.eventId },
        data: { approvedSpendUsd: { increment: expense.amountUsd } },
      })
    } else if (expense.status === 'APPROVED' && parsed.data.status && parsed.data.status !== 'APPROVED') {
      await tx.event.update({
        where: { id: expense.eventId },
        data: { approvedSpendUsd: { decrement: expense.amountUsd } },
      })
    }

    return result
  })

  const actionType = parsed.data.status === 'APPROVED' ? 'APPROVE'
    : parsed.data.status === 'REJECTED' ? 'REJECT'
    : 'SUBMIT'

  const auditAction: Record<string, string> = {
    SUBMITTED: 'EXPENSE_SUBMITTED',
    APPROVED: 'EXPENSE_APPROVED',
    REJECTED: 'EXPENSE_REJECTED',
  }

  await prisma.approvalAction.create({
    data: {
      companyId: session.user.companyId,
      actorId: session.user.id,
      expenseId: params.id,
      actionType,
      note: parsed.data.rejectionNote,
    },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: auditAction[parsed.data.status ?? ''] ?? 'EXPENSE_UPDATED',
    entityType: 'Expense',
    entityId: params.id,
    payload: { status: parsed.data.status, note: parsed.data.rejectionNote },
  })

  if (parsed.data.status === 'APPROVED' || parsed.data.status === 'REJECTED') {
    notifyExpenseStatusChanged({
      employeeName: expense.employee.name ?? 'Employee',
      amountUsd: Number(expense.amountUsd),
      description: expense.description,
      newStatus: parsed.data.status,
      actorName: session.user.name ?? 'Team member',
      rejectionNote: parsed.data.rejectionNote,
    }).catch(() => {})
  }

  const employeeEmail = (expense.employee as { name: string; email: string }).email
  if (parsed.data.status === 'APPROVED' && employeeEmail) {
    emailExpenseApproved(employeeEmail, expense.employee.name ?? 'there', {
      amountUsd: Number(expense.amountUsd),
      description: expense.description,
      actorName: session.user.name ?? 'Your manager',
      expenseId: params.id,
    }).catch(() => {})
  } else if (parsed.data.status === 'REJECTED' && employeeEmail) {
    emailExpenseRejected(employeeEmail, expense.employee.name ?? 'there', {
      amountUsd: Number(expense.amountUsd),
      description: expense.description,
      rejectionNote: parsed.data.rejectionNote,
      actorName: session.user.name ?? 'Your manager',
      expenseId: params.id,
    }).catch(() => {})
  }

  return NextResponse.json(updated)
}
