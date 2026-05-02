import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'TRAVEL_AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const travelRequest = await prisma.travelRequest.findFirst({
    where: { id: params.id, companyId: session.user.companyId, status: 'PENDING_AGENT' },
  })
  if (!travelRequest) return NextResponse.json({ error: 'Not found or already assigned' }, { status: 404 })

  await prisma.travelRequest.update({
    where: { id: params.id },
    data: { agentId: session.user.id },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'BOOKING_ASSIGNED',
    entityType: 'TravelRequest',
    entityId: params.id,
    payload: { agentId: session.user.id },
  })

  return NextResponse.json({ success: true })
}
