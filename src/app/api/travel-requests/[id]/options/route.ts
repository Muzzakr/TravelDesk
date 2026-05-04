import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { notifyOptionsProvided } from '@/lib/notify'
import { z } from 'zod'

const OptionsSchema = z.object({
  options: z
    .array(
      z.object({
        serviceType: z.string().min(1),
        vendor: z.string().min(1),
        description: z.string().min(1),
        priceUsd: z.number().positive(),
      })
    )
    .min(1)
    .max(9),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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
  if (session.user.role !== 'TRAVEL_AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const travelRequest = await prisma.travelRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId, agentId: session.user.id },
    include: { employee: { select: { name: true } } },
  })
  if (!travelRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = OptionsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await prisma.bookingOption.deleteMany({ where: { travelRequestId: params.id } })
  await prisma.bookingOption.createMany({
    data: parsed.data.options.map((o) => ({
      travelRequestId: params.id,
      serviceType: o.serviceType,
      vendor: o.vendor,
      description: o.description,
      priceUsd: o.priceUsd,
    })),
  })

  await prisma.travelRequest.update({
    where: { id: params.id },
    data: { status: 'OPTIONS_PROVIDED' },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'BOOKING_OPTIONS_SUBMITTED',
    entityType: 'TravelRequest',
    entityId: params.id,
    payload: { optionCount: parsed.data.options.length },
  })

  notifyOptionsProvided({
    employeeName: travelRequest.employee.name ?? 'Employee',
    destination: travelRequest.destination,
    optionCount: parsed.data.options.length,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
