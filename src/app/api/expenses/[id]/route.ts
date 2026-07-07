import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { notifyExpenseStatusChanged } from '@/lib/notify'
import { createNotification } from '@/lib/notifications'
import { emailExpenseApproved, emailExpenseRejected, emailExpenseToFinance } from '@/lib/mail'
import { clientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const UpdateSchema = z.object({
  status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  rejectionNote: z.string().optional(),
  amountUsd: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  merchantName: z.string().optional(),
  transactionDate: z.string().optional(),
  reason: z.string().min(1).optional(),
  personName: z.string().optional(),
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
    include: {
      employee: { select: { name: true, email: true } },
      event: { select: { eventCode: true, eventName: true } },
    },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Paid expenses are immutable
  if (expense.status === 'PAID') {
    return NextResponse.json({ error: 'Paid expenses cannot be modified' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const isFieldEdit = !parsed.data.status && (
    parsed.data.amountUsd !== undefined ||
    parsed.data.description !== undefined ||
    parsed.data.merchantName !== undefined ||
    parsed.data.transactionDate !== undefined ||
    parsed.data.reason !== undefined ||
    parsed.data.personName !== undefined
  )

  if (isFieldEdit) {
    if (expense.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only DRAFT expenses can be edited' }, { status: 403 })
    }
    if (expense.employeeId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.amountUsd !== undefined && { amountUsd: parsed.data.amountUsd }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.merchantName !== undefined && { merchantName: parsed.data.merchantName || null }),
        ...(parsed.data.transactionDate !== undefined && {
          transactionDate: parsed.data.transactionDate ? new Date(parsed.data.transactionDate) : null,
        }),
        ...(parsed.data.reason !== undefined && { reason: parsed.data.reason }),
        ...(parsed.data.personName !== undefined && { personName: parsed.data.personName || null }),
      },
    })
    await writeAuditLog({
      companyId: session.user.companyId,
      actorId: session.user.id,
      action: 'EXPENSE_UPDATED',
      entityType: 'Expense',
      entityId: params.id,
      payload: { fields: Object.keys(parsed.data) },
    })
    return NextResponse.json(updated)
  }

  if (parsed.data.status === 'REJECTED' && !parsed.data.rejectionNote) {
    return NextResponse.json({ error: 'rejectionNote required when rejecting' }, { status: 400 })
  }

  const role = session.user.role ?? ''
  const approverRoles = ['MANAGER', 'TRAVEL_MANAGER', 'FINANCE_ADMIN', 'SYSTEM_ADMIN']

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
      ipAddress: clientIp(req),
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

    await createNotification({
      companyId: session.user.companyId,
      userId: expense.employeeId,
      type: 'workflow_update',
      title: 'Your expense was approved',
      description: `${expense.description} · $${Number(expense.amountUsd).toFixed(2)}`,
      href: `/employee/expenses/${params.id}`,
    })

    // Notify finance that the expense is approved and ready for payout
    const financeAdmins = await prisma.user.findMany({
      where: { companyId: session.user.companyId, role: 'FINANCE_ADMIN', isActive: true },
      select: { id: true, name: true, email: true },
    })
    const eventCode = (expense as { event?: { eventCode: string } | null }).event?.eventCode ?? ''
    for (const fa of financeAdmins) {
      if (fa.id === session.user.id || !fa.email) continue
      emailExpenseToFinance(fa.email, fa.name ?? 'there', {
        employeeName: expense.employee.name ?? 'Employee',
        amountUsd: Number(expense.amountUsd),
        category: expense.category,
        description: expense.description,
        reason: expense.reason,
        eventCode,
        approverName: session.user.name ?? 'Manager',
        expenseId: params.id,
      }).catch(() => {})
      await createNotification({
        companyId: session.user.companyId,
        userId: fa.id,
        type: 'expense_pending',
        title: 'Expense ready for payout',
        description: `${expense.employee.name ?? 'Employee'} · ${expense.description} · $${Number(expense.amountUsd).toFixed(2)}`,
        href: `/finance/expenses`,
      })
    }
  } else if (parsed.data.status === 'REJECTED' && employeeEmail) {
    emailExpenseRejected(employeeEmail, expense.employee.name ?? 'there', {
      amountUsd: Number(expense.amountUsd),
      description: expense.description,
      rejectionNote: parsed.data.rejectionNote,
      actorName: session.user.name ?? 'Your manager',
      expenseId: params.id,
    }).catch(() => {})

    await createNotification({
      companyId: session.user.companyId,
      userId: expense.employeeId,
      type: 'workflow_update',
      title: 'Your expense was not approved',
      description: `${expense.description} · $${Number(expense.amountUsd).toFixed(2)}`,
      href: `/employee/expenses/${params.id}`,
    })
  }

  return NextResponse.json(updated)
}
