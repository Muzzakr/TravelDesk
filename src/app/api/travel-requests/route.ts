import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { checkEventBudget } from '@/lib/policy-engine'
import { determineRoutingPath } from '@/lib/routing-engine'
import { notifyTravelRequestCreated } from '@/lib/notify'
import { emailRequestConfirmation, emailPendingManagerApproval, emailAgentActionRequired } from '@/lib/mail'
import { z } from 'zod'

const CreateSchema = z.object({
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

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where =
    session.user.role === 'EMPLOYEE'
      ? { companyId: session.user.companyId, employeeId: session.user.id }
      : { companyId: session.user.companyId }

  const requests = await prisma.travelRequest.findMany({
    where,
    include: { employee: { select: { name: true, email: true } }, event: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creatorRoles = ['EMPLOYEE', 'TRAVEL_AGENT']
  if (!creatorRoles.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Validate event belongs to company and is active
  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, companyId: session.user.companyId, status: 'ACTIVE' },
  })
  if (!event) return NextResponse.json({ error: 'Invalid or inactive event' }, { status: 400 })

  // Budget check
  const budgetCheck = await checkEventBudget(
    session.user.companyId,
    parsed.data.eventId,
    parsed.data.estimatedCostUsd ?? 0
  )
  if (budgetCheck.budgetExceeded) {
    return NextResponse.json({ error: 'Event budget cap exceeded', budgetCheck }, { status: 422 })
  }

  const routingPath = determineRoutingPath({
    estimatedCostUsd: parsed.data.estimatedCostUsd ?? 0,
    departureDateIso: parsed.data.travelDates.departureDate,
    servicesRequested: parsed.data.servicesRequested,
  })

  const initialStatus =
    routingPath === 'AGENT_FIRST' || routingPath === 'PARALLEL' ? 'PENDING_AGENT' : 'PENDING_MANAGER'

  const travelRequest = await prisma.travelRequest.create({
    data: {
      companyId: session.user.companyId,
      employeeId: session.user.id,
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
    action: 'TRAVEL_REQUEST_SUBMITTED',
    entityType: 'TravelRequest',
    entityId: travelRequest.id,
    payload: { eventId: parsed.data.eventId, routingPath, estimatedCostUsd: parsed.data.estimatedCostUsd },
  })

  notifyTravelRequestCreated({
    employeeName: session.user.name ?? session.user.email ?? 'Employee',
    origin: parsed.data.origin,
    destination: parsed.data.destination,
    departureDate: parsed.data.travelDates.departureDate,
    estimatedCostUsd: parsed.data.estimatedCostUsd,
    status: initialStatus,
    requestId: travelRequest.id,
  }).catch(() => {})

  // Email: confirmation to employee
  if (session.user.email) {
    emailRequestConfirmation(session.user.email, session.user.name ?? 'there', {
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      departureDate: parsed.data.travelDates.departureDate,
      eventName: event.eventName,
      estimatedCostUsd: parsed.data.estimatedCostUsd,
      requestId: travelRequest.id,
      nextStatus: initialStatus,
    }).catch(() => {})
  }

  // Email: manager or agents depending on routing
  if (initialStatus === 'PENDING_MANAGER') {
    const emp = await prisma.user.findUnique({ where: { id: session.user.id }, select: { managerId: true } })
    if (emp?.managerId) {
      const manager = await prisma.user.findUnique({ where: { id: emp.managerId }, select: { name: true, email: true } })
      if (manager?.email) {
        emailPendingManagerApproval(manager.email, manager.name ?? 'Manager', {
          employeeName: session.user.name ?? session.user.email ?? 'Employee',
          origin: parsed.data.origin,
          destination: parsed.data.destination,
          departureDate: parsed.data.travelDates.departureDate,
          estimatedCostUsd: parsed.data.estimatedCostUsd,
          requestId: travelRequest.id,
        }).catch(() => {})
      }
    }
  } else if (initialStatus === 'PENDING_AGENT') {
    const agents = await prisma.user.findMany({
      where: { companyId: session.user.companyId, role: 'TRAVEL_AGENT', isActive: true },
      select: { name: true, email: true },
    })
    for (const agent of agents) {
      emailAgentActionRequired(agent.email, agent.name ?? 'Agent', {
        employeeName: session.user.name ?? session.user.email ?? 'Employee',
        origin: parsed.data.origin,
        destination: parsed.data.destination,
        requestId: travelRequest.id,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ...travelRequest, budgetWarning: budgetCheck.warningTriggered }, { status: 201 })
}
