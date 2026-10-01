// Weekly corporate/fleet-card statement import — parsing and reconciliation.
//
// Deliberately pure, no Prisma/DB calls in here (that lives in the API
// route) — the matching logic is the part most worth getting right and
// easiest to get subtly wrong, so it's built to be tested directly with
// plain fixtures, the same way routing-engine.ts and policy-engine.ts are.
//
// The statement export has no native transaction ID and no reliable
// employee email/ID — only a physical card's ID + last four digits, which
// is why this file exists at all rather than just reusing the webhook's
// upsert-by-transactionId logic.

import * as XLSX from 'xlsx'
import crypto from 'crypto'

// ─── Parsing ────────────────────────────────────────────────────────────────

export type ParsedStatementRow = {
  transactionDate: Date
  merchant: string
  amountUsd: number
  cardId: string
  cardLastFour: string
  cardProgram: string
  category: string | null
  vehicle: string | null
}

export type ParseResult = {
  rows: ParsedStatementRow[]
  // Rows present in the file but excluded — declined/pending/non-purchase
  // rows, or rows missing a field this importer can't work without.
  skipped: number
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,]/g, '').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// dateRaw: "9/25/26" or "09/25/26" (M/D/YY). timeRaw: "10:55AM" / "11:06PM".
// Parsed as wall-clock values, not converted to a precise UTC instant against
// a real EST offset — exact timezone correctness doesn't matter here, only
// that the same string parses to the same Date every time (that's what the
// dedup keys below depend on), so this is deliberately simple.
function parseDateTime(dateRaw: string, timeRaw: string): Date | null {
  const dateMatch = dateRaw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!dateMatch) return null
  const [, mm, dd, yy] = dateMatch
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy)
  const month = Number(mm) - 1
  const day = Number(dd)

  let hour = 0
  let minute = 0
  const timeMatch = timeRaw.trim().match(/^(\d{1,2}):(\d{2})(AM|PM)$/i)
  if (timeMatch) {
    const [, hh, min, ampm] = timeMatch
    hour = Number(hh) % 12
    minute = Number(min)
    if (ampm.toUpperCase() === 'PM') hour += 12
  }

  const d = new Date(year, month, day, hour, minute)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Parses the weekly statement CSV. Only `Status = Completed` and
 * `Type = Purchase` rows are kept — declined attempts never actually
 * charged anything, and `Bill Payment`/`Fee` rows (card balance payoffs,
 * platform subscription fees) aren't purchases to reconcile against an
 * event at all.
 *
 * Uses `xlsx` (already a dependency elsewhere in this app) rather than a
 * naive split(','), since real rows contain quoted fields with commas
 * inside them (e.g. a merchant name, or "2,802.5" miles). `cellText: true`
 * + `raw: false` keeps every cell as the literal source string instead of
 * xlsx's default behavior of silently converting date-looking text into
 * Excel serial numbers.
 */
export function parseCardStatementCsv(csvText: string): ParseResult {
  const workbook = XLSX.read(csvText, { type: 'string', cellText: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  if (raw.length < 2) return { rows: [], skipped: 0 }

  const headers = (raw[0] as string[]).map((h) => String(h ?? '').trim())
  const col = (name: string) => headers.indexOf(name)

  const iDate = col('Date')
  const iTime = col('Time (EST)')
  const iMerchant = col('Merchant Name')
  const iAmount = col('Amount')
  const iCardId = col('Card ID')
  const iCardLast4 = col('Card Last Four')
  const iCardType = col('Card Type')
  const iCategory = col('Category')
  const iVehicle = col('Vehicle')
  const iStatus = col('Status')
  const iType = col('Type')

  let skipped = 0
  const rows: ParsedStatementRow[] = []

  for (const line of raw.slice(1) as string[][]) {
    if (!line.some((c) => c !== '')) continue // blank line, not a real row

    const status = String(line[iStatus] ?? '').trim()
    const type = String(line[iType] ?? '').trim()
    if (status !== 'Completed' || type !== 'Purchase') {
      skipped++
      continue
    }

    const cardId = String(line[iCardId] ?? '').trim()
    const cardLastFour = String(line[iCardLast4] ?? '').trim()
    const merchant = String(line[iMerchant] ?? '').trim()
    if (!cardId || !cardLastFour || !merchant) {
      skipped++
      continue
    }

    const amountUsd = parseAmount(String(line[iAmount] ?? ''))
    if (amountUsd === null || amountUsd <= 0) {
      skipped++
      continue
    }

    const transactionDate = parseDateTime(String(line[iDate] ?? ''), String(line[iTime] ?? ''))
    if (!transactionDate) {
      skipped++
      continue
    }

    rows.push({
      transactionDate,
      merchant,
      amountUsd,
      cardId,
      cardLastFour,
      cardProgram: String(line[iCardType] ?? '').trim() || 'Unknown',
      category: String(line[iCategory] ?? '').trim() || null,
      vehicle: String(line[iVehicle] ?? '').trim() || null,
    })
  }

  return { rows, skipped }
}

// ─── Matching keys ──────────────────────────────────────────────────────────

type Identity = { transactionDate: Date; cardId: string; cardLastFour: string; merchant: string }

/**
 * Identity ignoring amount — this is what lets the importer recognize "the
 * same real-world transaction reappearing" even if its amount has since
 * been corrected on settlement, and what lets it notice a previously-seen
 * transaction that's gone missing from a later statement pull.
 */
export function looseKey(row: Identity): string {
  return [
    row.transactionDate.toISOString(),
    row.cardId.trim().toUpperCase(),
    row.cardLastFour.trim(),
    row.merchant.trim().toLowerCase(),
  ].join('|')
}

/** Full identity including amount — an exact match means "already have it, do nothing." */
export function exactKey(row: Identity & { amountUsd: number }): string {
  return `${looseKey(row)}|${row.amountUsd.toFixed(2)}`
}

/**
 * Deterministic synthetic transaction ID. The statement export has no
 * native transaction ID (unlike the webhook feed's `transactionId`), so
 * this is what lets the same row be recognized as already-imported across
 * repeated, overlapping weekly uploads without ever double-creating it.
 */
export function syntheticTransactionId(row: Identity & { amountUsd: number }): string {
  const hash = crypto.createHash('sha256').update(exactKey(row)).digest('hex').slice(0, 24)
  return `import-${hash}`
}

// ─── Reconciliation ─────────────────────────────────────────────────────────

export type ExistingTransaction = {
  id: string
  transactionDate: Date
  merchant: string
  amountUsd: number
  cardId: string | null
  cardLastFour: string | null
}

export type CardMappingEntry = { cardId: string; cardLastFour: string; employeeId: string }

export type ReconciliationPlan = {
  toCreate: Array<ParsedStatementRow & { transactionId: string; employeeId: string | null }>
  mismatchReviews: Array<{
    existingId: string
    incomingAmountUsd: number
    incomingMerchant: string
    incomingCategory: string | null
  }>
  missingReviews: Array<{ existingId: string }>
  skippedExisting: number
}

/**
 * Pure reconciliation: given this upload's parsed rows, a snapshot of
 * existing transactions, the card→employee mapping, and the set of
 * existing-transaction IDs that already have a PENDING review (so repeated
 * uploads of an unresolved discrepancy never spawn a second review item),
 * decides exactly what should happen — nothing here touches a database.
 *
 * Every row falls into exactly one bucket:
 *  - exact match already exists      -> counted in skippedExisting, no action
 *  - loose match exists, amount differs -> mismatchReviews (never auto-resolved)
 *  - no match at all                 -> toCreate
 * Separately, any existing transaction whose date falls inside this
 * upload's own date range but who never appears in it at all -> missingReviews.
 */
export function reconcileStatement(
  rows: ParsedStatementRow[],
  existing: ExistingTransaction[],
  mappings: CardMappingEntry[],
  existingPendingReviewTransactionIds: Set<string>
): ReconciliationPlan {
  const mappingIndex = new Map(mappings.map((m) => [`${m.cardId.toUpperCase()}|${m.cardLastFour}`, m.employeeId]))

  const existingByExact = new Map<string, ExistingTransaction>()
  const existingByLoose = new Map<string, ExistingTransaction>()
  for (const tx of existing) {
    if (!tx.cardId || !tx.cardLastFour) continue
    const identity = { transactionDate: tx.transactionDate, cardId: tx.cardId, cardLastFour: tx.cardLastFour, merchant: tx.merchant }
    existingByExact.set(exactKey({ ...identity, amountUsd: tx.amountUsd }), tx)
    existingByLoose.set(looseKey(identity), tx)
  }

  const plan: ReconciliationPlan = { toCreate: [], mismatchReviews: [], missingReviews: [], skippedExisting: 0 }
  const seenLooseKeysInUpload = new Set<string>()

  for (const row of rows) {
    const loose = looseKey(row)
    seenLooseKeysInUpload.add(loose)

    if (existingByExact.has(exactKey(row))) {
      plan.skippedExisting++
      continue
    }

    const looseMatch = existingByLoose.get(loose)
    if (looseMatch) {
      if (!existingPendingReviewTransactionIds.has(looseMatch.id)) {
        plan.mismatchReviews.push({
          existingId: looseMatch.id,
          incomingAmountUsd: row.amountUsd,
          incomingMerchant: row.merchant,
          incomingCategory: row.category,
        })
      }
      continue
    }

    const employeeId = mappingIndex.get(`${row.cardId.toUpperCase()}|${row.cardLastFour}`) ?? null
    plan.toCreate.push({ ...row, transactionId: syntheticTransactionId(row), employeeId })
  }

  if (rows.length > 0) {
    // Calendar-day range, not exact timestamps — "does this existing
    // transaction fall within the days this statement covers," not a
    // razor's-edge comparison against the single earliest/latest row.
    const dayStarts = rows.map((r) => new Date(r.transactionDate.getFullYear(), r.transactionDate.getMonth(), r.transactionDate.getDate()).getTime())
    const minDay = Math.min(...dayStarts)
    const maxDay = Math.max(...dayStarts) + 24 * 60 * 60 * 1000 - 1

    for (const tx of existing) {
      if (!tx.cardId || !tx.cardLastFour) continue
      const t = tx.transactionDate.getTime()
      if (t < minDay || t > maxDay) continue
      const loose = looseKey({ transactionDate: tx.transactionDate, cardId: tx.cardId, cardLastFour: tx.cardLastFour, merchant: tx.merchant })
      if (seenLooseKeysInUpload.has(loose)) continue
      if (existingPendingReviewTransactionIds.has(tx.id)) continue
      plan.missingReviews.push({ existingId: tx.id })
    }
  }

  return plan
}
