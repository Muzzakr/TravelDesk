import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const SelectSchema = z.object({
  optionIds: z.array(z.string().min(1)).min(1),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const travelRequest = await prisma.travelRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId, employeeId: session.user.id },
  })
  if (!travelRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (travelRequest.status !== 'OPTIONS_PROVIDED') {
    return NextResponse.json({ error: 'No options to select at this stage' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = SelectSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { optionIds } = parsed.data

  // Verify all selected options belong to this request
  const options = await prisma.bookingOption.findMany({
    where: { travelRequestId: params.id },
  })
  const validIds = new Set(options.map((o) => o.id))
  for (const oid of optionIds) {
    if (!validIds.has(oid)) return NextResponse.json({ error: `Option ${oid} not found` }, { status: 404 })
  }

  // Clear all, then mark selected
  await prisma.bookingOption.updateMany({
    where: { travelRequestId: params.id },
    data: { isSelected: false },
  })
  await prisma.bookingOption.updateMany({
    where: { id: { in: optionIds } },
    data: { isSelected: true },
  })

  // Advance to manager approval
  await prisma.travelRequest.update({
    where: { id: params.id },
    data: { status: 'PENDING_MANAGER' },
  })

  const selectedOptions = options.filter((o) => optionIds.includes(o.id))
  const totalUsd = selectedOptions.reduce((sum, o) => sum + Number(o.priceUsd), 0)

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'BOOKING_OPTION_SELECTED',
    entityType: 'TravelRequest',
    entityId: params.id,
    payload: { optionIds, totalUsd, vendors: selectedOptions.map((o) => o.vendor) },
  })

  return NextResponse.json({ success: true })
}
