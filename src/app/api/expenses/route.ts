import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { checkExpensePolicy } from '@/lib/policy-engine'
import { notifyExpenseSubmitted } from '@/lib/notify'
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
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where =
    session.user.role === 'EMPLOYEE'
      ? { companyId: session.user.companyId, employeeId: session.user.id }
      : { companyId: session.user.companyId }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      employee: { select: { name: true, email: true } },
      event: { select: { eventCode: true, eventName: true } },
      receipts: { select: { id: true, fileName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, companyId: session.user.companyId, status: 'ACTIVE' },
  })
  if (!event) return NextResponse.json({ error: 'Invalid or inactive event' }, { status: 400 })

  const policyFlags = await checkExpensePolicy({
    companyId: session.user.companyId,
    eventId: parsed.data.eventId,
    amountUsd: parsed.data.amountUsd,
    category: parsed.data.category,
    hasReceipt: false,
  })

  const blocked = policyFlags.filter((f) => f.severity === 'BLOCK' && f.type !== 'MISSING_RECEIPT')
  if (blocked.length > 0) {
    return NextResponse.json({ error: 'Policy violation', flags: blocked }, { status: 422 })
  }

  const expense = await prisma.expense.create({
    data: {
      companyId: session.user.companyId,
      employeeId: session.user.id,
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

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'EXPENSE_SUBMITTED',
    entityType: 'Expense',
    entityId: expense.id,
    payload: { eventId: parsed.data.eventId, amountUsd: parsed.data.amountUsd, category: parsed.data.category },
  })

  notifyExpenseSubmitted({
    employeeName: session.user.name ?? session.user.email ?? 'Employee',
    amountUsd: parsed.data.amountUsd,
    category: parsed.data.category,
    description: parsed.data.description,
    eventCode: event.eventCode,
  }).catch(() => {})

  // Email manager
  const emp = await prisma.user.findUnique({ where: { id: session.user.id }, select: { managerId: true } })
  if (emp?.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: emp.managerId }, select: { name: true, email: true } })
    if (manager?.email) {
      emailExpenseToManager(manager.email, manager.name ?? 'Manager', {
        employeeName: session.user.name ?? session.user.email ?? 'Employee',
        amountUsd: parsed.data.amountUsd,
        category: parsed.data.category,
        description: parsed.data.description,
        eventCode: event.eventCode,
        expenseId: expense.id,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ expense, warnings: policyFlags.filter((f) => f.severity === 'WARNING') }, { status: 201 })
}
