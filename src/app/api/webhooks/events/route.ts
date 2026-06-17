import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { toDate } from '@/lib/normalise-date'
import { z } from 'zod'

const EventSchema = z.object({
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

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json({ error: 'Missing X-Api-Key header' }, { status: 401 })

  const company = await prisma.company.findUnique({ where: { webhookApiKey: apiKey } })
  if (!company) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const adminUser = await prisma.user.findFirst({
    where: { companyId: company.id, role: 'SYSTEM_ADMIN' },
    select: { id: true },
  })
  if (!adminUser) return NextResponse.json({ error: 'No admin user found for this company' }, { status: 500 })
  const ownerUserId = adminUser.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const items = Array.isArray(body) ? body : [body]

  let created = 0
  let updated = 0
  const errors: string[] = []

  for (const item of items) {
    const parsed = EventSchema.safeParse(item)
    if (!parsed.success) {
      errors.push(`"${(item as Record<string, unknown>)?.eventCode ?? '?'}": ${JSON.stringify(parsed.error.flatten().fieldErrors)}`)
      continue
    }

    const d = parsed.data
    try {
      const existing = await prisma.event.findUnique({
        where: { companyId_eventCode: { companyId: company.id, eventCode: d.eventCode } },
      })

      await prisma.event.upsert({
        where: { companyId_eventCode: { companyId: company.id, eventCode: d.eventCode } },
        create: {
          companyId: company.id,
          ownerUserId,
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
        },
        update: {
          eventName: d.eventName,
          status: d.status,
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
          budgetUsd: d.budgetUsd,
        },
      })

      if (existing) updated++; else created++
    } catch (err) {
      console.error('Webhook upsert error:', err)
      errors.push(`"${d.eventCode}": internal error`)
    }
  }

  await writeAuditLog({
    companyId: company.id,
    action: 'WEBHOOK_EVENTS_UPSERTED',
    entityType: 'Event',
    entityId: company.id,
    payload: { created, updated, errors: errors.length },
  })

  return NextResponse.json({ created, updated, errors })
}
