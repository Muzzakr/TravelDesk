import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { parseCardStatementCsv, reconcileStatement } from '@/lib/card-import'
import { notifyCardChargesAssigned } from '@/lib/card-notify'

// Weekly (always trailing ~30 days, deliberately overlapping the previous
// upload) corporate/fleet-card statement import. Re-uploading data already
// seen is always safe — exact matches are silently skipped, never
// duplicated; only genuine new/changed/missing transactions produce any
// effect at all. See src/lib/card-import.ts for the reconciliation rules.

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const csvText = await file.text()
  const { rows, skipped: skippedInvalidRows } = parseCardStatementCsv(csvText)

  if (rows.length === 0) {
    return NextResponse.json(
      { created: 0, skippedExisting: 0, skippedInvalidRows, mismatchReviewsCreated: 0, missingReviewsCreated: 0, unmappedCardCount: 0 },
      { status: 200 }
    )
  }

  // Bound the "existing transactions" query to a buffer around this
  // upload's own date range, rather than the company's entire history —
  // nothing outside that window could possibly match or be flagged missing.
  const dates = rows.map((r) => r.transactionDate.getTime())
  const bufferMs = 3 * 24 * 60 * 60 * 1000
  const rangeStart = new Date(Math.min(...dates) - bufferMs)
  const rangeEnd = new Date(Math.max(...dates) + bufferMs)

  const [existingTransactions, mappings, pendingReviews] = await Promise.all([
    prisma.cardTransaction.findMany({
      where: { companyId, transactionDate: { gte: rangeStart, lte: rangeEnd } },
      select: { id: true, transactionDate: true, merchant: true, amountUsd: true, cardId: true, cardLastFour: true },
    }),
    prisma.cardMapping.findMany({
      where: { companyId },
      select: { cardId: true, cardLastFour: true, employeeId: true },
    }),
    prisma.cardTransactionReview.findMany({
      where: { companyId, status: 'PENDING' },
      select: { cardTransactionId: true },
    }),
  ])

  const plan = reconcileStatement(
    rows,
    existingTransactions.map((t) => ({ ...t, amountUsd: Number(t.amountUsd) })),
    mappings,
    new Set(pendingReviews.map((r) => r.cardTransactionId))
  )

  await prisma.$transaction([
    ...(plan.toCreate.length > 0
      ? [
          prisma.cardTransaction.createMany({
            data: plan.toCreate.map((row) => ({
              companyId,
              transactionId: row.transactionId,
              merchant: row.merchant,
              amountUsd: row.amountUsd,
              transactionDate: row.transactionDate,
              cardProgram: row.cardProgram,
              cardId: row.cardId,
              cardLastFour: row.cardLastFour,
              category: row.category,
              vehicle: row.vehicle,
              employeeId: row.employeeId,
              status: 'PENDING_TAG',
            })),
          }),
        ]
      : []),
    ...plan.mismatchReviews.map((r) =>
      prisma.cardTransactionReview.create({
        data: {
          companyId,
          cardTransactionId: r.existingId,
          type: 'AMOUNT_MISMATCH',
          incomingAmountUsd: r.incomingAmountUsd,
          incomingMerchant: r.incomingMerchant,
          incomingCategory: r.incomingCategory,
        },
      })
    ),
    ...plan.missingReviews.map((r) =>
      prisma.cardTransactionReview.create({
        data: { companyId, cardTransactionId: r.existingId, type: 'MISSING_IN_STATEMENT' },
      })
    ),
  ])

  const unmappedCardCount = new Set(
    plan.toCreate.filter((r) => !r.employeeId).map((r) => `${r.cardId}|${r.cardLastFour}`)
  ).size

  // One notification per employee, not per transaction — a single import
  // can auto-assign several charges to the same person via CardMapping.
  const countByEmployee = new Map<string, number>()
  for (const row of plan.toCreate) {
    if (!row.employeeId) continue
    countByEmployee.set(row.employeeId, (countByEmployee.get(row.employeeId) ?? 0) + 1)
  }
  await Promise.all(
    [...countByEmployee.entries()].map(([employeeId, count]) => notifyCardChargesAssigned(companyId, employeeId, count))
  )

  const summary = {
    created: plan.toCreate.length,
    skippedExisting: plan.skippedExisting,
    skippedInvalidRows,
    mismatchReviewsCreated: plan.mismatchReviews.length,
    missingReviewsCreated: plan.missingReviews.length,
    unmappedCardCount,
  }

  await writeAuditLog({
    companyId,
    actorId: session.user.id,
    action: 'CARD_STATEMENT_IMPORTED',
    entityType: 'CardTransaction',
    entityId: 'bulk',
    payload: summary,
  })

  return NextResponse.json(summary, { status: 201 })
}
