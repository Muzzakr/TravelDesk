import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const PatchSchema = z.object({
  budgetUsd: z.number().min(0).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
})

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

  await prisma.event.delete({ where: { id: params.id } })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'EVENT_DELETED',
    entityType: 'Event',
    entityId: params.id,
    payload: { eventName: event.eventName, eventCode: event.eventCode },
  })

  return NextResponse.json({ ok: true })
}
