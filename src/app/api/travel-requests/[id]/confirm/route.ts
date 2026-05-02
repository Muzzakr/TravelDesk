import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const ConfirmSchema = z.object({
  confirmationNumber: z.string().min(1),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'TRAVEL_AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const travelRequest = await prisma.travelRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId, agentId: session.user.id },
  })
  if (!travelRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['APPROVED', 'OPTIONS_PROVIDED', 'PENDING_MANAGER'].includes(travelRequest.status)) {
    return NextResponse.json({ error: 'Cannot confirm at this stage' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = ConfirmSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await prisma.travelRequest.update({
    where: { id: params.id },
    data: {
      status: 'BOOKING_CONFIRMED',
      confirmationNumber: parsed.data.confirmationNumber,
      specialInstructions: parsed.data.notes
        ? `${travelRequest.specialInstructions ? travelRequest.specialInstructions + '\n' : ''}Agent notes: ${parsed.data.notes}`
        : travelRequest.specialInstructions,
    },
  })

  // Auto-create DRAFT expense records from selected booking options
  const selectedOptions = await prisma.bookingOption.findMany({
    where: { travelRequestId: params.id, isSelected: true },
  })

  const categoryMap: Record<string, 'TRANSPORT' | 'ACCOMMODATION'> = {
    FLIGHT: 'TRANSPORT',
    CAR_RENTAL: 'TRANSPORT',
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
    // Fallback: create one draft expense from estimated cost
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
    payload: { confirmationNumber: parsed.data.confirmationNumber },
  })

  return NextResponse.json({ success: true })
}
