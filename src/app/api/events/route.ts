import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { toDate } from '@/lib/normalise-date'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const CreateEventSchema = z.object({
  eventCode: z.string().min(1),
  eventName: z.string().min(1),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
  venue: z.string().optional(),
  address: z.string().optional(),
  eventDate: z.string().optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  timing: z.string().optional(),
  assignedDj: z.string().optional(),
  assignedMc: z.string().optional(),
  salesPerson: z.string().optional(),
  costCenter: z.string().optional(),
  budgetUsd: z.number().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const events = await prisma.event.findMany({
    where: { companyId: session.user.companyId },
    orderBy: [{ eventDate: 'asc' }, { eventCode: 'asc' }],
  })
  // Imports populate `eventDate` (single date) but not the dateStart/dateEnd
  // range that the booking/travel UI reads. Fall back so dates show correctly
  // instead of rendering a null date as 1970-01-01.
  const withDates = events.map((e) => ({
    ...e,
    dateStart: e.dateStart ?? e.eventDate,
    dateEnd: e.dateEnd ?? e.eventDate,
  }))
  return NextResponse.json(withDates)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SYSTEM_ADMIN', 'FINANCE_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = CreateEventSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const data: Prisma.EventUncheckedCreateInput = {
    companyId: session.user.companyId,
    ownerUserId: session.user.id,
    eventCode: d.eventCode,
    eventName: d.eventName,
    status: d.status ?? 'DRAFT',
    venue: d.venue,
    address: d.address,
    eventDate: toDate(d.eventDate),
    dateStart: toDate(d.dateStart),
    dateEnd: toDate(d.dateEnd),
    timing: d.timing,
    assignedDj: d.assignedDj,
    assignedMc: d.assignedMc,
    salesPerson: d.salesPerson,
    costCenter: d.costCenter,
    budgetUsd: d.budgetUsd ?? 0,
  }
  let event
  try {
    event = await prisma.event.upsert({
      where: { companyId_eventCode: { companyId: session.user.companyId, eventCode: d.eventCode } },
      create: data,
      update: {
        eventName: data.eventName,
        status: data.status,
        venue: data.venue,
        address: data.address,
        eventDate: data.eventDate,
        dateStart: data.dateStart,
        dateEnd: data.dateEnd,
        timing: data.timing,
        assignedDj: data.assignedDj,
        assignedMc: data.assignedMc,
        salesPerson: data.salesPerson,
        costCenter: data.costCenter,
        budgetUsd: data.budgetUsd,
      },
    })
  } catch (err: unknown) {
    console.error('Event upsert error:', err)
    return NextResponse.json({ error: 'Failed to save event' }, { status: 500 })
  }

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'EVENT_UPSERTED',
    entityType: 'Event',
    entityId: event.id,
    payload: { eventCode: event.eventCode, eventName: event.eventName },
  })

  return NextResponse.json(event, { status: 201 })
}
