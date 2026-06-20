import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['TRAVEL_AGENT', 'MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await prisma.user.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      manager: { select: { id: true, name: true, email: true } },
      travelerProfile: true,
      travelRequests: {
        where: { companyId: session.user.companyId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          origin: true,
          destination: true,
          status: true,
          travelDates: true,
          servicesRequested: true,
          estimatedCostUsd: true,
          preferredClass: true,
          purpose: true,
          createdAt: true,
          event: { select: { eventName: true, eventCode: true } },
        },
      },
      expenses: {
        where: { companyId: session.user.companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          category: true,
          description: true,
          amountUsd: true,
          status: true,
          transactionDate: true,
          service: true,
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(user)
}
