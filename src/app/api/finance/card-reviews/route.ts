import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Lists the two edge cases a weekly re-import surfaces for a human decision
// (see src/lib/card-import.ts): AMOUNT_MISMATCH — the same transaction
// reappeared with a different amount/merchant/category — and
// MISSING_IN_STATEMENT — a previously-imported transaction is absent from
// a statement window that should have covered it. Nothing here is ever
// auto-resolved; this is purely the queue awaiting a decision.

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'PENDING'

  const reviews = await prisma.cardTransactionReview.findMany({
    where: { companyId: session.user.companyId, status: status as 'PENDING' | 'RESOLVED' },
    orderBy: { createdAt: 'desc' },
    include: {
      cardTransaction: {
        select: { id: true, merchant: true, amountUsd: true, category: true, transactionDate: true, cardId: true, cardLastFour: true, voidedAt: true },
      },
      resolvedBy: { select: { id: true, name: true } },
    },
    take: 100,
  })

  return NextResponse.json(reviews)
}
