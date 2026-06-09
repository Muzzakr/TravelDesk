import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { notifyTravelRequestStatusChanged } from '@/lib/notify'
import { emailRequestApproved, emailRequestRejected, emailAgentActionRequired } from '@/lib/mail'
import { z } from 'zod'
import type { TravelRequestStatus } from '@prisma/client'

const UpdateSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED', 'BOOKING_CONFIRMED']).optional(),
  rejectionNote: z.string().optional(),
  agentId: z.string().optional(),
  // Edit fields (allowed before first approval)
  purpose: z.string().optional(),
  estimatedCostUsd: z.number().optional(),
  specialInstructions: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const request = await prisma.travelRequest.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        event: true,
        approvalActions: { include: { actor: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
        bookingOptions:        { orderBy: { createdAt: 'asc' } },
        bookingConfirmations:  { orderBy: { createdAt: 'asc' } },
        expenses: { select: { id: true, description: true, amountUsd: true, category: true, status: true, merchantName: true } },
      },
    })
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(request)
  } catch (err) {
    console.error('[GET /api/travel-requests/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const request = await prisma.travelRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    include: { employee: { select: { name: true, email: true } } },
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

  // Allow employee to edit purpose/notes/cost before first approval
  const editableFields = parsed.data.purpose !== undefined || parsed.data.estimatedCostUsd !== undefined || parsed.data.specialInstructions !== undefined
  if (editableFields && !parsed.data.status) {
    const editableStatuses = ['SUBMITTED', 'PENDING_MANAGER', 'DRAFT']
    if (!editableStatuses.includes(request.status)) {
      return NextResponse.json({ error: 'Request can only be edited before manager approval' }, { status: 400 })
    }
    if (request.employeeId !== session.user.id && !['SYSTEM_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const edited = await prisma.travelRequest.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.purpose !== undefined && { purpose: parsed.data.purpose }),
        ...(parsed.data.estimatedCostUsd !== undefined && { estimatedCostUsd: parsed.data.estimatedCostUsd }),
        ...(parsed.data.specialInstructions !== undefined && { specialInstructions: parsed.data.specialInstructions }),
      },
    })
    await writeAuditLog({
      companyId: session.user.companyId, actorId: session.user.id,
      action: 'TRAVEL_REQUEST_EDITED', entityType: 'TravelRequest', entityId: params.id,
      payload: { purpose: parsed.data.purpose, estimatedCostUsd: parsed.data.estimatedCostUsd },
    })
    return NextResponse.json(edited)
  }

  let nextStatus: string | undefined = parsed.data.status
  if (parsed.data.status === 'APPROVED' && request.status === 'PENDING_MANAGER') {
    // Always forward to travel agent after manager approval
    nextStatus = 'PENDING_AGENT'
  }

  const updated = await prisma.travelRequest.update({
    where: { id: params.id },
    data: {
      rejectionNote: parsed.data.rejectionNote,
      agentId: parsed.data.agentId,
      status: nextStatus as TravelRequestStatus | undefined,
    },
  })

  const actionType = nextStatus === 'APPROVED' || nextStatus === 'PENDING_AGENT' ? 'APPROVE'
    : parsed.data.status === 'REJECTED' ? 'REJECT'
    : 'MODIFY'

  const auditAction: Record<string, string> = {
    APPROVED: 'TRAVEL_REQUEST_APPROVED',
    PENDING_AGENT: 'TRAVEL_REQUEST_MANAGER_APPROVED',
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
    action: auditAction[nextStatus ?? ''] ?? 'TRAVEL_REQUEST_UPDATED',
    entityType: 'TravelRequest',
    entityId: params.id,
    payload: { status: nextStatus, note: parsed.data.rejectionNote },
  })

  if (nextStatus && ['APPROVED', 'PENDING_AGENT', 'REJECTED', 'CANCELLED', 'BOOKING_CONFIRMED'].includes(nextStatus)) {
    notifyTravelRequestStatusChanged({
      employeeName: request.employee.name ?? 'Employee',
      destination: request.destination,
      nextStatus,
      actorName: session.user.name ?? 'Team member',
      rejectionNote: parsed.data.rejectionNote,
      confirmationNumber: (updated as Record<string, unknown>).confirmationNumber as string | null,
    }).catch(() => {})
  }

  const employeeEmail = (request.employee as { name: string; email: string }).email

  if (nextStatus === 'APPROVED') {
    if (employeeEmail) {
      emailRequestApproved(employeeEmail, request.employee.name ?? 'there', {
        destination: request.destination,
        requestId: params.id,
        actorName: session.user.name ?? 'Your manager',
      }).catch(() => {})
    }
    if (request.agentId) {
      const agent = await prisma.user.findUnique({ where: { id: request.agentId }, select: { name: true, email: true } })
      if (agent?.email) {
        emailAgentActionRequired(agent.email, agent.name ?? 'Agent', {
          employeeName: request.employee.name ?? 'Employee',
          origin: request.origin,
          destination: request.destination,
          requestId: params.id,
        }).catch(() => {})
      }
    }
  } else if (nextStatus === 'PENDING_AGENT') {
    const agents = await prisma.user.findMany({
      where: { companyId: session.user.companyId, role: 'TRAVEL_AGENT', isActive: true },
      select: { name: true, email: true },
    })
    for (const agent of agents) {
      emailAgentActionRequired(agent.email, agent.name ?? 'Agent', {
        employeeName: request.employee.name ?? 'Employee',
        origin: request.origin,
        destination: request.destination,
        requestId: params.id,
      }).catch(() => {})
    }
  } else if (nextStatus === 'REJECTED') {
    if (employeeEmail) {
      emailRequestRejected(employeeEmail, request.employee.name ?? 'there', {
        destination: request.destination,
        rejectionNote: parsed.data.rejectionNote,
        requestId: params.id,
        actorName: session.user.name ?? 'Your manager',
      }).catch(() => {})
    }
  }

  return NextResponse.json(updated)
}
