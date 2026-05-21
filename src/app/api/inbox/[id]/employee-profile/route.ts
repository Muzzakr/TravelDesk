import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['TRAVEL_AGENT', 'MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const message = await prisma.travelInboxMessage.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = message.parsedData as Record<string, string> | null
  const employeeName = parsed?.employeeName?.trim()
  if (!employeeName) return NextResponse.json({ profile: null, user: null })

  const user = await prisma.user.findFirst({
    where: {
      companyId: session.user.companyId,
      name: { contains: employeeName, mode: 'insensitive' },
    },
    include: { travelerProfile: true },
  })

  if (!user) return NextResponse.json({ profile: null, user: null })

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
    profile: user.travelerProfile ?? null,
  })
}
