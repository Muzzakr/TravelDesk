import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED', 'BOOKING_CONFIRMED']).optional(),
  rejectionNote: z.string().optional(),
  agentId: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const request = await prisma.travelRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      event: true,
      approvalActions: { include: { actor: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
      bookingOptions: { orderBy: { createdAt: 'asc' } },
      expenses: { select: { id: true, description: true, amountUsd: true, category: true, status: true, merchantName: true } },
    },
  })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(request)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const request = await prisma.travelRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (parsed.data.status === 'REJECTED' && !parsed.data.rejectionNote) {
    return NextResponse.json({ error: 'rejectionNote is required when rejecting' }, { status: 400 })
  }

  const role = session.user.role ?? ''
  const approverRoles = ['MANAGER', 'TRAVEL_AGENT', 'FINANCE_ADMIN', 'SYSTEM_ADMIN']

  if (parsed.data.status === 'CANCELLED') {
    if (request.employeeId !== session.user.id && !approverRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (parsed.data.status) {
    if (!approverRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const updated = await prisma.travelRequest.update({
    where: { id: params.id },
    data: parsed.data,
  })

  const actionType = parsed.data.status === 'APPROVED' ? 'APPROVE'
    : parsed.data.status === 'REJECTED' ? 'REJECT'
    : 'MODIFY'

  const auditAction: Record<string, string> = {
    APPROVED: 'TRAVEL_REQUEST_APPROVED',
    REJECTED: 'TRAVEL_REQUEST_REJECTED',
    CANCELLED: 'TRAVEL_REQUEST_CANCELLED',
    BOOKING_CONFIRMED: 'TRAVEL_REQUEST_BOOKING_CONFIRMED',
  }

  await prisma.approvalAction.create({
    data: {
      companyId: session.user.companyId,
      actorId: session.user.id,
      travelRequestId: params.id,
      actionType,
      note: parsed.data.rejectionNote,
    },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: auditAction[parsed.data.status ?? ''] ?? 'TRAVEL_REQUEST_UPDATED',
    entityType: 'TravelRequest',
    entityId: params.id,
    payload: { status: parsed.data.status, note: parsed.data.rejectionNote },
  })

  return NextResponse.json(updated)
}
