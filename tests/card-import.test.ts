/**
 * @jest-environment node
 *
 * Weekly card-statement import: parsing and reconciliation. Both are pure
 * functions (no DB), so tested directly with fixtures — this is the
 * trickiest logic in the whole card-transaction feature, worth real
 * coverage rather than trusting it by inspection.
 */
import {
  parseCardStatementCsv,
  reconcileStatement,
  looseKey,
  exactKey,
  syntheticTransactionId,
  type ExistingTransaction,
  type ParsedStatementRow,
} from '@/lib/card-import'

const HEADER =
  'Date,Time (EST),User,Vehicle,Type,Amount,Card ID,Card Last Four,Card Type,Merchant Name,Category,Status'

describe('parseCardStatementCsv', () => {
  it('keeps only Completed + Purchase rows', () => {
    const csv = [
      HEADER,
      '09/25/26,10:55AM,Nirmal Patel,,Purchase,$88.00,YQX002,3488,Fleet,Green Street Fuel,Gas Stations,Completed',
      '09/26/26,11:06PM,,,Purchase,$7.45,YQX008,8658,Fleet,Google Castly,Software,Declined',
      '08/30/26,06:50AM,,,Bill Payment,"-$6,448.74",,,,Coast - Auto Payment,,Completed',
      '09/20/26,07:59PM,,,Fee,$0.00,,,,Coast subscription fee,,Completed',
    ].join('\n')

    const { rows, skipped } = parseCardStatementCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].merchant).toBe('Green Street Fuel')
    expect(rows[0].amountUsd).toBe(88)
    expect(skipped).toBe(3)
  })

  it('handles quoted fields containing commas (merchant name and thousand-separated numbers)', () => {
    const csv = [
      HEADER,
      '09/19/26,12:28PM,,,Purchase,$31.98,YQX008,8658,Fleet,"Castly -Roku, Chromecast,DLNA",Software,Completed',
    ].join('\n')

    const { rows } = parseCardStatementCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].merchant).toBe('Castly -Roku, Chromecast,DLNA')
    expect(rows[0].amountUsd).toBeCloseTo(31.98)
  })

  it('parses date + time into a real Date, and captures card identity/category/vehicle', () => {
    const csv = [
      HEADER,
      '09/25/26,10:55AM,Nirmal Patel,M4U TRANSIT 2 Blue,Purchase,$88.00,YQX002,3488,Fleet,Green Street Fuel,Gas Stations,Completed',
    ].join('\n')

    const { rows } = parseCardStatementCsv(csv)
    expect(rows[0].cardId).toBe('YQX002')
    expect(rows[0].cardLastFour).toBe('3488')
    expect(rows[0].category).toBe('Gas Stations')
    expect(rows[0].vehicle).toBe('M4U TRANSIT 2 Blue')
    expect(rows[0].transactionDate.getFullYear()).toBe(2026)
    expect(rows[0].transactionDate.getMonth()).toBe(8) // September, 0-indexed
    expect(rows[0].transactionDate.getDate()).toBe(25)
    expect(rows[0].transactionDate.getHours()).toBe(10)
    expect(rows[0].transactionDate.getMinutes()).toBe(55)
  })

  it('skips a Completed Purchase row missing a required field rather than crashing', () => {
    const csv = [HEADER, '09/25/26,10:55AM,Nirmal Patel,,Purchase,$88.00,,,,,,Completed'].join('\n')
    const { rows, skipped } = parseCardStatementCsv(csv)
    expect(rows).toHaveLength(0)
    expect(skipped).toBe(1)
  })

  it('returns empty on a header-only or empty file', () => {
    expect(parseCardStatementCsv(HEADER).rows).toHaveLength(0)
    expect(parseCardStatementCsv('').rows).toHaveLength(0)
  })
})

function row(overrides: Partial<ParsedStatementRow> = {}): ParsedStatementRow {
  return {
    transactionDate: new Date(2026, 8, 25, 10, 55),
    merchant: 'Green Street Fuel',
    amountUsd: 88,
    cardId: 'YQX002',
    cardLastFour: '3488',
    cardProgram: 'Fleet',
    category: 'Gas Stations',
    vehicle: null,
    ...overrides,
  }
}

function existing(overrides: Partial<ExistingTransaction> = {}): ExistingTransaction {
  return {
    id: 'existing-1',
    transactionDate: new Date(2026, 8, 25, 10, 55),
    merchant: 'Green Street Fuel',
    amountUsd: 88,
    cardId: 'YQX002',
    cardLastFour: '3488',
    ...overrides,
  }
}

describe('reconcileStatement', () => {
  it('creates a brand-new transaction with no existing match', () => {
    const plan = reconcileStatement([row()], [], [], new Set())
    expect(plan.toCreate).toHaveLength(1)
    expect(plan.toCreate[0].employeeId).toBeNull()
    expect(plan.mismatchReviews).toHaveLength(0)
    expect(plan.missingReviews).toHaveLength(0)
    expect(plan.skippedExisting).toBe(0)
  })

  it('assigns the employee from CardMapping when the card is mapped', () => {
    const plan = reconcileStatement(
      [row()],
      [],
      [{ cardId: 'YQX002', cardLastFour: '3488', employeeId: 'emp-1' }],
      new Set()
    )
    expect(plan.toCreate[0].employeeId).toBe('emp-1')
  })

  it('skips an exact match — no create, no review', () => {
    const plan = reconcileStatement([row()], [existing()], [], new Set())
    expect(plan.toCreate).toHaveLength(0)
    expect(plan.skippedExisting).toBe(1)
    expect(plan.mismatchReviews).toHaveLength(0)
  })

  it('flags an amount mismatch instead of creating a duplicate or silently overwriting', () => {
    const plan = reconcileStatement([row({ amountUsd: 95 })], [existing({ amountUsd: 88 })], [], new Set())
    expect(plan.toCreate).toHaveLength(0)
    expect(plan.mismatchReviews).toEqual([
      { existingId: 'existing-1', incomingAmountUsd: 95, incomingMerchant: 'Green Street Fuel', incomingCategory: 'Gas Stations' },
    ])
  })

  it('does not spawn a second mismatch review if one is already pending for the same transaction', () => {
    const plan = reconcileStatement(
      [row({ amountUsd: 95 })],
      [existing({ amountUsd: 88 })],
      [],
      new Set(['existing-1'])
    )
    expect(plan.mismatchReviews).toHaveLength(0)
  })

  it('flags a previously-imported transaction missing from a statement window that should cover it', () => {
    // Upload spans Sept 20-28; the existing transaction dated the 25th
    // falls inside that range and should have appeared somewhere in it,
    // but doesn't.
    const plan = reconcileStatement(
      [
        row({ transactionDate: new Date(2026, 8, 20), merchant: 'Some Other Purchase' }),
        row({ transactionDate: new Date(2026, 8, 28), merchant: 'Yet Another Purchase' }),
      ],
      [existing({ transactionDate: new Date(2026, 8, 25, 10, 55) })],
      [],
      new Set()
    )
    expect(plan.missingReviews).toEqual([{ existingId: 'existing-1' }])
  })

  it("does not flag an existing transaction outside the uploaded statement's date range", () => {
    const plan = reconcileStatement(
      [row({ transactionDate: new Date(2026, 8, 20) })],
      [existing({ transactionDate: new Date(2026, 5, 1) })], // June — well outside range
      [],
      new Set()
    )
    expect(plan.missingReviews).toHaveLength(0)
  })

  it('does not spawn a second missing review if one is already pending', () => {
    const plan = reconcileStatement(
      [row({ transactionDate: new Date(2026, 8, 20), merchant: 'Unrelated' })],
      [existing({ transactionDate: new Date(2026, 8, 25, 10, 55) })],
      [],
      new Set(['existing-1'])
    )
    expect(plan.missingReviews).toHaveLength(0)
  })
})

describe('key helpers', () => {
  it('exactKey differs only by amount from looseKey', () => {
    const r = row()
    expect(exactKey(r)).toBe(`${looseKey(r)}|88.00`)
  })

  it('syntheticTransactionId is stable for identical rows and differs when amount changes', () => {
    const a = syntheticTransactionId(row())
    const b = syntheticTransactionId(row())
    const c = syntheticTransactionId(row({ amountUsd: 95 }))
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^import-[0-9a-f]{24}$/)
  })
})
