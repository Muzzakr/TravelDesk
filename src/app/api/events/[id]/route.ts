import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { emailEventStatusChanged, emailBudgetUpdated, emailEventDeleted } from '@/lib/mail'
import { z } from 'zod'

const PatchSchema = z.object({
  budgetUsd: z.number().min(0).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SYSTEM_ADMIN', 'FINANCE_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const event = await prisma.event.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [count, sum] = await Promise.all([
    prisma.expense.count({ where: { eventId: params.id } }),
    prisma.expense.aggregate({ where: { eventId: params.id }, _sum: { amountUsd: true } }),
  ])

  return NextResponse.json({
    expenseCount: count,
    expenseTotalUsd: Number(sum._sum.amountUsd ?? 0),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SYSTEM_ADMIN', 'FINANCE_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const event = await prisma.event.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.event.update({
    where: { id: params.id },
    data: parsed.data,
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'EVENT_BUDGET_UPDATED',
    entityType: 'Event',
    entityId: params.id,
    payload: parsed.data,
  })

  const owner = await prisma.user.findUnique({ where: { id: event.ownerUserId }, select: { name: true, email: true } })
  if (owner?.email) {
    if (parsed.data.status && ['ACTIVE', 'CLOSED'].includes(parsed.data.status) && parsed.data.status !== event.status) {
      emailEventStatusChanged(owner.email, owner.name ?? 'there', {
        eventName: event.eventName, eventId: event.id, status: parsed.data.status as 'ACTIVE' | 'CLOSED',
      }, session.user.companyId).catch(() => {})
    }
    if (parsed.data.budgetUsd !== undefined && parsed.data.budgetUsd !== Number(event.budgetUsd)) {
      emailBudgetUpdated(owner.email, owner.name ?? 'there', {
        eventName: event.eventName, eventId: event.id, budgetUsd: parsed.data.budgetUsd,
      }, session.user.companyId).catch(() => {})
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SYSTEM_ADMIN', 'MANAGER'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const event = await prisma.event.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const owner = await prisma.user.findUnique({ where: { id: event.ownerUserId }, select: { name: true, email: true } })

  await prisma.event.delete({ where: { id: params.id } })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'EVENT_DELETED',
    entityType: 'Event',
    entityId: params.id,
    payload: { eventName: event.eventName, eventCode: event.eventCode },
  })

  if (owner?.email) {
    emailEventDeleted(owner.email, owner.name ?? 'there', {
      eventName: event.eventName, eventCode: event.eventCode,
    }, session.user.companyId).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
