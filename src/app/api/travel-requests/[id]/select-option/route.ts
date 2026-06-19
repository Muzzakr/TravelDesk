import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { emailPendingManagerApproval } from '@/lib/mail'
import { createNotification } from '@/lib/notifications'
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

  // Calculate old selected total before clearing (to compute delta)
  const oldTotal = options
    .filter((o) => o.isSelected)
    .reduce((sum, o) => sum + Number(o.priceUsd), 0)

  // Clear all, then mark selected
  await prisma.bookingOption.updateMany({
    where: { travelRequestId: params.id },
    data: { isSelected: false },
  })
  await prisma.bookingOption.updateMany({
    where: { id: { in: optionIds } },
    data: { isSelected: true },
  })

  const nextStatus = travelRequest.routingPath === 'MANAGER_FIRST' ? 'APPROVED' : 'PENDING_MANAGER'
  await prisma.travelRequest.update({
    where: { id: params.id },
    data: { status: nextStatus },
  })

  const selectedOptions = options.filter((o) => optionIds.includes(o.id))
  const totalUsd = selectedOptions.reduce((sum, o) => sum + Number(o.priceUsd), 0)

  // Update event approved spend by the delta (handles re-selection correctly)
  const delta = totalUsd - oldTotal
  if (delta !== 0) {
    await prisma.event.update({
      where: { id: travelRequest.eventId },
      data: { approvedSpendUsd: { increment: delta } },
    })
  }

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'BOOKING_OPTION_SELECTED',
    entityType: 'TravelRequest',
    entityId: params.id,
    payload: { optionIds, totalUsd, vendors: selectedOptions.map((o) => o.vendor) },
  })

  // Email manager to approve
  const emp = await prisma.user.findUnique({
    where: { id: travelRequest.employeeId },
    select: { name: true, email: true, managerId: true },
  })
  if (emp?.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: emp.managerId }, select: { name: true, email: true } })
    if (manager?.email) {
      emailPendingManagerApproval(manager.email, manager.name ?? 'Manager', {
        employeeName: emp.name ?? 'Employee',
        origin: travelRequest.origin,
        destination: travelRequest.destination,
        departureDate: (travelRequest.travelDates as { departureDate: string }).departureDate,
        requestId: params.id,
      }).catch(() => {})
    }
    await createNotification({
      companyId: session.user.companyId,
      userId: emp.managerId,
      type: 'travel_pending',
      title: 'Travel request awaiting your approval',
      description: `${emp.name ?? 'Employee'} · ${travelRequest.origin} → ${travelRequest.destination}`,
      href: `/manager/approvals/travel/${params.id}`,
    })
  }

  return NextResponse.json({ success: true })
}
