import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['TRAVEL_AGENT', 'MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const channel  = searchParams.get('channel')  // TRAVEL_CARS | TRAVEL_FLIGHTS | TRAVEL_HOTELS
  const status   = searchParams.get('status')   // NEW | IN_PROGRESS | DONE | IGNORED
  const search   = searchParams.get('search') ?? ''
  const take     = Math.min(Number(searchParams.get('take') ?? '50'), 100)

  const messages = await prisma.travelInboxMessage.findMany({
    where: {
      companyId: session.user.companyId,
      ...(channel ? { channel: channel as 'TRAVEL_CARS' | 'TRAVEL_FLIGHTS' | 'TRAVEL_HOTELS' } : {}),
      ...(status  ? { status: status as 'NEW' | 'IN_PROGRESS' | 'DONE' | 'IGNORED' } : {}),
      ...(search  ? { rawText: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take,
  })

  return NextResponse.json(messages)
}
