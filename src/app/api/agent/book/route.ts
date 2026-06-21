import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { determineRoutingPath } from '@/lib/routing-engine'
import { emailRequestCreatedOnBehalf } from '@/lib/mail'
import { z } from 'zod'

const BookSchema = z.object({
  employeeId: z.string().min(1),
  eventId: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  travelDates: z.object({ departureDate: z.string(), returnDate: z.string() }),
  servicesRequested: z.array(z.string()).min(1),
  estimatedCostUsd: z.number().positive().optional(),
  purpose: z.string().min(1),
  preferredClass: z.enum(['ECONOMY', 'BUSINESS', 'FIRST']).optional(),
  hotelNights: z.number().int().positive().optional(),
  carRentalDays: z.number().int().positive().optional(),
  specialInstructions: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['TRAVEL_AGENT', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = BookSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const employee = await prisma.user.findFirst({
    where: { id: parsed.data.employeeId, companyId: session.user.companyId, isActive: true },
  })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 400 })

  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, companyId: session.user.companyId, status: 'ACTIVE' },
  })
  if (!event) return NextResponse.json({ error: 'Invalid or inactive event' }, { status: 400 })

  const routingPath = determineRoutingPath({
    estimatedCostUsd: parsed.data.estimatedCostUsd ?? 0,
    departureDateIso: parsed.data.travelDates.departureDate,
    servicesRequested: parsed.data.servicesRequested,
  })

  // Agent creates directly on behalf — already assigned, skip straight to OPTIONS_PROVIDED flow
  const initialStatus = 'PENDING_AGENT'

  const travelRequest = await prisma.travelRequest.create({
    data: {
      companyId: session.user.companyId,
      employeeId: parsed.data.employeeId,
      agentId: session.user.id,
      eventId: parsed.data.eventId,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      travelDates: parsed.data.travelDates,
      servicesRequested: parsed.data.servicesRequested,
      estimatedCostUsd: parsed.data.estimatedCostUsd,
      purpose: parsed.data.purpose,
      preferredClass: parsed.data.preferredClass ?? 'ECONOMY',
      hotelNights: parsed.data.hotelNights,
      carRentalDays: parsed.data.carRentalDays,
      specialInstructions: parsed.data.specialInstructions,
      routingPath,
      status: initialStatus,
    },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'TRAVEL_REQUEST_BOOKED_ON_BEHALF',
    entityType: 'TravelRequest',
    entityId: travelRequest.id,
    payload: { employeeId: parsed.data.employeeId, routingPath, estimatedCostUsd: parsed.data.estimatedCostUsd },
  })

  emailRequestCreatedOnBehalf(employee.email, employee.name ?? 'there', {
    origin: parsed.data.origin,
    destination: parsed.data.destination,
    departureDate: parsed.data.travelDates.departureDate,
    eventName: event.eventName,
    agentName: session.user.name ?? 'Your travel agent',
    requestId: travelRequest.id,
  }).catch(() => {})

  return NextResponse.json(travelRequest, { status: 201 })
}
