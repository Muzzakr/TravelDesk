import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

// Resolving a card-transaction review is always a human decision — nothing
// here is ever triggered automatically by an import. See
// src/lib/card-import.ts for how these reviews get created in the first
// place.

const ResolveSchema = z.object({
  // AMOUNT_MISMATCH: kept_existing (discard the newer statement's numbers)
  // or kept_incoming (the existing record's amount/merchant/category get
  // overwritten with what this statement showed).
  // MISSING_IN_STATEMENT: kept (leave exactly as-is, just clear the flag)
  // or removed (soft-void — see CardTransaction.voidedAt; never a hard
  // delete, consistent with how this app treats financial records
  // elsewhere, e.g. a PAID expense can never be modified).
  resolution: z.enum(['kept_existing', 'kept_incoming', 'kept', 'removed']),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = ResolveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const review = await prisma.cardTransactionReview.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (review.status !== 'PENDING') return NextResponse.json({ error: 'Already resolved' }, { status: 400 })

  const { resolution } = parsed.data
  const validForType =
    (review.type === 'AMOUNT_MISMATCH' && (resolution === 'kept_existing' || resolution === 'kept_incoming')) ||
    (review.type === 'MISSING_IN_STATEMENT' && (resolution === 'kept' || resolution === 'removed'))
  if (!validForType)
    return NextResponse.json({ error: `resolution "${resolution}" is not valid for a ${review.type} review` }, { status: 400 })

  await prisma.$transaction(async (tx) => {
    if (resolution === 'kept_incoming') {
      await tx.cardTransaction.update({
        where: { id: review.cardTransactionId },
        data: {
          amountUsd: review.incomingAmountUsd ?? undefined,
          merchant: review.incomingMerchant ?? undefined,
          category: review.incomingCategory,
        },
      })
    }
    if (resolution === 'removed') {
      await tx.cardTransaction.update({ where: { id: review.cardTransactionId }, data: { voidedAt: new Date() } })
    }

    await tx.cardTransactionReview.update({
      where: { id: review.id },
      data: { status: 'RESOLVED', resolution, resolvedById: session.user.id, resolvedAt: new Date() },
    })
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'CARD_REVIEW_RESOLVED',
    entityType: 'CardTransactionReview',
    entityId: review.id,
    payload: { type: review.type, resolution, cardTransactionId: review.cardTransactionId },
  })

  return NextResponse.json({ ok: true })
}
