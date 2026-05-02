import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

export async function POST() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000)

  const stale = await prisma.travelRequest.findMany({
    where: {
      companyId,
      status: 'PENDING_MANAGER',
      updatedAt: { lt: cutoff },
      routingPath: { not: 'PARALLEL' },
    },
    select: { id: true },
  })

  if (stale.length === 0) return NextResponse.json({ escalated: 0 })

  await prisma.travelRequest.updateMany({
    where: { id: { in: stale.map((r) => r.id) } },
    data: { routingPath: 'PARALLEL' },
  })

  for (const r of stale) {
    await writeAuditLog({
      companyId,
      actorId: session.user.id,
      action: 'ESCALATED_72H',
      entityType: 'TravelRequest',
      entityId: r.id,
      payload: { reason: 'Manager inaction > 72h' },
    })
  }

  return NextResponse.json({ escalated: stale.length })
}
