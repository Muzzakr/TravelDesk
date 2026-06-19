import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { notifyOptionsProvided } from '@/lib/notify'
import { createNotification } from '@/lib/notifications'
import { emailOptionsProvided } from '@/lib/mail'
import { z } from 'zod'

const OptionsSchema = z.object({
  options: z
    .array(
      z.object({
        serviceType: z.string().min(1),
        vendor: z.string().min(1),
        description: z.string().min(1),
        priceUsd: z.number().positive(),
        bookingLink: z.string().url().nullish(),
      })
    )
    .min(1)
    .max(9),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const options = await prisma.bookingOption.findMany({
    where: { travelRequestId: params.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(options)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['TRAVEL_AGENT', 'EMPLOYEE'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAgent = session.user.role === 'TRAVEL_AGENT'
  const travelRequest = await prisma.travelRequest.findFirst({
    where: {
      id: params.id,
      companyId: session.user.companyId,
      ...(isAgent ? { agentId: session.user.id } : { employeeId: session.user.id }),
    },
    include: { employee: { select: { name: true, email: true } } },
  })
  if (!travelRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = OptionsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Guard: if employee has already selected options, require explicit force flag
  const selectedCount = await prisma.bookingOption.count({
    where: { travelRequestId: params.id, isSelected: true },
  })
  if (selectedCount > 0 && !body.force) {
    return NextResponse.json(
      { error: 'Employee has already selected options. Pass force=true to overwrite and reset their selection.', selectionExists: true },
      { status: 409 }
    )
  }

  await prisma.bookingOption.deleteMany({ where: { travelRequestId: params.id } })
  await prisma.bookingOption.createMany({
    data: parsed.data.options.map((o) => ({
      travelRequestId: params.id,
      serviceType: o.serviceType,
      vendor: o.vendor,
      description: o.description,
      priceUsd: o.priceUsd,
      bookingLink: o.bookingLink ?? null,
    })),
  })

  if (isAgent) {
    await prisma.travelRequest.update({
      where: { id: params.id },
      data: { status: 'OPTIONS_PROVIDED' },
    })
  }

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'BOOKING_OPTIONS_SUBMITTED',
    entityType: 'TravelRequest',
    entityId: params.id,
    payload: { optionCount: parsed.data.options.length },
  })

  if (isAgent) {
    notifyOptionsProvided({
      employeeName: travelRequest.employee.name ?? 'Employee',
      destination: travelRequest.destination,
      optionCount: parsed.data.options.length,
    }).catch(() => {})

    emailOptionsProvided(travelRequest.employee.email, travelRequest.employee.name ?? 'there', {
      destination: travelRequest.destination,
      optionCount: parsed.data.options.length,
      requestId: params.id,
    }).catch(() => {})

    await createNotification({
      companyId: session.user.companyId,
      userId: travelRequest.employeeId,
      type: 'workflow_update',
      title: 'Booking options are ready',
      description: `${parsed.data.options.length} option${parsed.data.options.length > 1 ? 's' : ''} for ${travelRequest.destination}`,
      href: `/employee/travel-requests/${params.id}`,
    })
  }

  return NextResponse.json({ success: true })
}
