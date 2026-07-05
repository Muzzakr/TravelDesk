import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { checkExpensePolicy } from '@/lib/policy-engine'
import { notifyExpenseSubmitted } from '@/lib/notify'
import { createNotification } from '@/lib/notifications'
import { emailExpenseToManager } from '@/lib/mail'
import { z } from 'zod'

const CreateSchema = z.object({
  eventId: z.string().min(1),
  travelRequestId: z.string().optional(),
  category: z.enum(['MEALS', 'TRANSPORT', 'ACCOMMODATION', 'SUPPLIES', 'OTHER']),
  expenseType: z.enum(['OUT_OF_POCKET', 'CORPORATE_CARD']).optional(),
  amountUsd: z.number().positive(),
  currency: z.string().default('USD'),
  description: z.string().min(1),
  merchantName: z.string().optional(),
  transactionDate: z.string().optional(),
  service: z.string().optional(),
  reason: z.string().min(1),
  personName: z.string().optional(),
  employeeId: z.string().optional(), // admin-only: create on behalf of employee
})

const EXPENSE_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID'] as const
type ExpenseStatusFilter = (typeof EXPENSE_STATUSES)[number]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  // Optional comma-separated status filter, e.g. ?status=SUBMITTED,UNDER_REVIEW
  const statuses = (searchParams.get('status') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is ExpenseStatusFilter => (EXPENSE_STATUSES as readonly string[]).includes(s))
  // Cap the result size — company-wide queries must not dump the whole table
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '') || 500, 1), 500)

  const where = {
    companyId: session.user.companyId,
    ...(session.user.role === 'EMPLOYEE' && { employeeId: session.user.id }),
    ...(statuses.length > 0 && { status: { in: statuses } }),
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      employee: { select: { name: true, email: true } },
      event: { select: { eventCode: true, eventName: true } },
      receipts: { select: { id: true, fileName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Parallel: event validation + policy check
  const [event, policyFlags] = await Promise.all([
    prisma.event.findFirst({
      where: { id: parsed.data.eventId, companyId: session.user.companyId, status: 'ACTIVE' },
    }),
    checkExpensePolicy({
      companyId: session.user.companyId,
      eventId: parsed.data.eventId,
      amountUsd: parsed.data.amountUsd,
      category: parsed.data.category,
      hasReceipt: false,
    }),
  ])

  if (!event) return NextResponse.json({ error: 'Invalid or inactive event' }, { status: 400 })

  const blocked = policyFlags.filter((f) => f.severity === 'BLOCK' && f.type !== 'MISSING_RECEIPT')
  if (blocked.length > 0) {
    return NextResponse.json({ error: 'Policy violation', flags: blocked }, { status: 422 })
  }

  const canSetEmployee = ['SYSTEM_ADMIN', 'TRAVEL_MANAGER', 'MANAGER'].includes(session.user.role ?? '')
  const targetEmployeeId = (canSetEmployee && parsed.data.employeeId) ? parsed.data.employeeId : session.user.id

  const expense = await prisma.expense.create({
    data: {
      companyId: session.user.companyId,
      employeeId: targetEmployeeId,
      eventId: parsed.data.eventId,
      travelRequestId: parsed.data.travelRequestId,
      category: parsed.data.category,
      expenseType: parsed.data.expenseType ?? 'OUT_OF_POCKET',
      amountUsd: parsed.data.amountUsd,
      currency: parsed.data.currency,
      description: parsed.data.description,
      merchantName: parsed.data.merchantName,
      transactionDate: parsed.data.transactionDate ? new Date(parsed.data.transactionDate) : null,
      service: parsed.data.service,
      reason: parsed.data.reason,
      personName: parsed.data.personName || null,
      status: 'SUBMITTED',
    },
  })

  // Fire-and-forget all side effects — user doesn't wait for these
  const employeeName = session.user.name ?? session.user.email ?? 'Employee';
  (async () => {
    const emp = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { managerId: true, manager: { select: { name: true, email: true } } },
    })
    await Promise.all([
      writeAuditLog({
        companyId: session.user.companyId,
        actorId: session.user.id,
        action: 'EXPENSE_SUBMITTED',
        entityType: 'Expense',
        entityId: expense.id,
        payload: { eventId: parsed.data.eventId, amountUsd: parsed.data.amountUsd, category: parsed.data.category },
      }),
      notifyExpenseSubmitted({
        employeeName,
        amountUsd: parsed.data.amountUsd,
        category: parsed.data.category,
        description: parsed.data.description,
        eventCode: event.eventCode,
      }).catch(() => {}),
      emp?.managerId
        ? Promise.all([
            emp.manager?.email
              ? emailExpenseToManager(emp.manager.email, emp.manager.name ?? 'Manager', {
                  employeeName,
                  amountUsd: parsed.data.amountUsd,
                  category: parsed.data.category,
                  description: parsed.data.description,
                  eventCode: event.eventCode,
                  expenseId: expense.id,
                }).catch(() => {})
              : Promise.resolve(),
            createNotification({
              companyId: session.user.companyId,
              userId: emp.managerId,
              type: 'expense_pending',
              title: 'Expense awaiting your approval',
              description: `${employeeName} · ${parsed.data.description} · $${parsed.data.amountUsd.toFixed(2)}`,
              href: `/manager/approvals/expense/${expense.id}`,
            }),
          ])
        : Promise.resolve(),
    ])
  })().catch(() => {})

  return NextResponse.json({ expense, warnings: policyFlags.filter((f) => f.severity === 'WARNING') }, { status: 201 })
}
