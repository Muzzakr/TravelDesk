import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role ?? ''
  if (!['MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requests = await prisma.travelRequest.findMany({
    where: {
      companyId: session.user.companyId,
      status: 'PENDING_MANAGER',
      managerId: null,
    },
    include: {
      employee: { select: { name: true, email: true } },
      event: { select: { eventName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(requests)
}
