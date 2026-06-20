import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role ?? ''
  if (!['MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const request = await prisma.travelRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.managerId) return NextResponse.json({ error: 'Request already claimed by another manager' }, { status: 409 })
  if (request.status !== 'PENDING_MANAGER') {
    return NextResponse.json({ error: 'Request is no longer pending manager approval' }, { status: 400 })
  }

  const updated = await prisma.travelRequest.update({
    where: { id: params.id },
    data: { managerId: session.user.id },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'TRAVEL_REQUEST_CLAIMED',
    entityType: 'TravelRequest',
    entityId: params.id,
    payload: { managerId: session.user.id },
  })

  return NextResponse.json(updated)
}
