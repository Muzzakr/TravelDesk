import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { emailBookingConfirmed } from '@/lib/mail'
import { createNotification } from '@/lib/notifications'
import { z } from 'zod'

const ServiceConfirmSchema = z.object({
  serviceType:        z.string().min(1),
  confirmationNumber: z.string().optional(),
  notes:              z.string().optional(),
})

const ConfirmSchema = z.object({
  services: z.array(ServiceConfirmSchema).min(1),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['TRAVEL_AGENT', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const travelRequest = await prisma.travelRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!travelRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['PENDING_AGENT', 'APPROVED'].includes(travelRequest.status)) {
    return NextResponse.json({ error: 'Cannot confirm at this stage' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = ConfirmSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Create one BookingConfirmation record per service
  const created = await prisma.$transaction(
    parsed.data.services.map((svc) =>
      prisma.bookingConfirmation.create({
        data: {
          travelRequestId: params.id,
          serviceType: svc.serviceType,
          confirmationNumber: svc.confirmationNumber || null,
          notes: svc.notes || null,
        },
      })
    )
  )

  const firstConfirmNo = parsed.data.services.find((s) => s.confirmationNumber)?.confirmationNumber ?? null

  await prisma.travelRequest.update({
    where: { id: params.id },
    data: {
      status: 'BOOKING_CONFIRMED',
      agentId: session.user.id,
      // keep flat field for backward compat / email
      confirmationNumber: firstConfirmNo,
    },
  })

  // Auto-create DRAFT expense records from selected booking options
  const selectedOptions = await prisma.bookingOption.findMany({
    where: { travelRequestId: params.id, isSelected: true },
  })

  const categoryMap: Record<string, 'TRANSPORT' | 'ACCOMMODATION'> = {
    FLIGHT: 'TRANSPORT',
    CAR_RENTAL: 'TRANSPORT',
    TAXI: 'TRANSPORT',
    HOTEL: 'ACCOMMODATION',
  }

  if (selectedOptions.length > 0) {
    await prisma.expense.createMany({
      data: selectedOptions.map((opt) => ({
        companyId: session.user.companyId,
        employeeId: travelRequest.employeeId,
        eventId: travelRequest.eventId,
        travelRequestId: params.id,
        category: categoryMap[opt.serviceType] ?? 'TRANSPORT',
        expenseType: 'CORPORATE_CARD' as const,
        amountUsd: opt.priceUsd,
        currency: 'USD',
        description: `${opt.serviceType} — ${opt.vendor}: ${opt.description}`,
        merchantName: opt.vendor,
        status: 'DRAFT',
      })),
    })
  } else if (travelRequest.estimatedCostUsd) {
    await prisma.expense.create({
      data: {
        companyId: session.user.companyId,
        employeeId: travelRequest.employeeId,
        eventId: travelRequest.eventId,
        travelRequestId: params.id,
        category: 'TRANSPORT',
        expenseType: 'CORPORATE_CARD',
        amountUsd: travelRequest.estimatedCostUsd,
        currency: 'USD',
        description: `Travel booking — ${travelRequest.origin} → ${travelRequest.destination}`,
        status: 'DRAFT',
      },
    })
  }

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'TRAVEL_REQUEST_BOOKING_CONFIRMED',
    entityType: 'TravelRequest',
    entityId: params.id,
    payload: { services: parsed.data.services.map((s) => s.serviceType) },
  })

  const employee = await prisma.user.findUnique({
    where: { id: travelRequest.employeeId },
    select: { name: true, email: true },
  })
  if (employee?.email) {
    emailBookingConfirmed(employee.email, employee.name ?? 'there', {
      origin: travelRequest.origin,
      destination: travelRequest.destination,
      departureDate: (travelRequest.travelDates as { departureDate: string }).departureDate,
      confirmationNumber: firstConfirmNo ?? 'See booking details',
      requestId: params.id,
    }).catch(() => {})
  }

  await createNotification({
    companyId: session.user.companyId,
    userId: travelRequest.employeeId,
    type: 'travel_booked',
    title: 'Your trip is booked',
    description: `${travelRequest.origin} → ${travelRequest.destination}`,
    href: `/employee/travel-requests/${params.id}`,
  })

  // Return created confirmation IDs so client can upload files
  const confirmationIds: Record<string, string> = {}
  created.forEach((c) => { confirmationIds[c.serviceType] = c.id })

  return NextResponse.json({ success: true, confirmationIds })
}
