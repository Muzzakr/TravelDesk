import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// An employee's own card charges — self-service counterpart to the Finance
// Card Transactions page. Scoped strictly to the caller; there is no way
// to see anyone else's charges through this route.

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const transactions = await prisma.cardTransaction.findMany({
    where: { companyId: session.user.companyId, employeeId: session.user.id, voidedAt: null },
    orderBy: { transactionDate: 'desc' },
    take: 100,
  })

  // eventId is a loose string reference, not a Prisma relation (see
  // schema.prisma) — same manual-join pattern the Finance route already
  // uses for employee names.
  const eventIds = [...new Set(transactions.map((t) => t.eventId).filter(Boolean))] as string[]
  const events = eventIds.length
    ? await prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, eventCode: true, eventName: true } })
    : []
  const eventMap = Object.fromEntries(events.map((e) => [e.id, e]))

  return NextResponse.json(transactions.map((t) => ({ ...t, event: t.eventId ? (eventMap[t.eventId] ?? null) : null })))
}
