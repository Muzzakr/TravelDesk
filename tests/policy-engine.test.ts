/**
 * @jest-environment node
 *
 * checkEventBudget decides whether a request/expense fits an event's
 * budget — it drives the warning banner and the hard block on new
 * spend. Prisma is mocked; no database needed.
 */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    event: { findFirst: jest.fn() },
    policyRule: { findFirst: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { checkEventBudget } from '@/lib/policy-engine'

const mockEventFindFirst = prisma.event.findFirst as jest.Mock
const mockRuleFindFirst = prisma.policyRule.findFirst as jest.Mock

function mockEvent(budgetUsd: number, approvedSpendUsd: number) {
  mockEventFindFirst.mockResolvedValue({ id: 'ev-1', budgetUsd, approvedSpendUsd })
}

describe('checkEventBudget', () => {
  beforeEach(() => {
    mockEventFindFirst.mockReset()
    mockRuleFindFirst.mockReset()
    mockRuleFindFirst.mockResolvedValue(null) // no custom rule → defaults apply
  })

  it('reports budget exceeded when the event cannot be found', async () => {
    mockEventFindFirst.mockResolvedValue(null)
    const result = await checkEventBudget('company-1', 'missing-event', 100)
    expect(result).toEqual({ withinBudget: false, warningTriggered: false, budgetExceeded: true, remainingUsd: 0 })
  })

  it('is within budget and quiet when spend is well under the cap', async () => {
    mockEvent(10000, 2000)
    const result = await checkEventBudget('company-1', 'ev-1', 500) // projected 2500 / 10000 = 25%
    expect(result.withinBudget).toBe(true)
    expect(result.warningTriggered).toBe(false)
    expect(result.budgetExceeded).toBe(false)
    expect(result.remainingUsd).toBe(8000)
  })

  it('triggers the warning at the default 80% threshold without blocking', async () => {
    mockEvent(1000, 750)
    const result = await checkEventBudget('company-1', 'ev-1', 50) // projected 800 / 1000 = 80%
    expect(result.warningTriggered).toBe(true)
    expect(result.budgetExceeded).toBe(false)
    expect(result.withinBudget).toBe(true)
  })

  it('blocks at the default 100% threshold', async () => {
    mockEvent(1000, 900)
    const result = await checkEventBudget('company-1', 'ev-1', 150) // projected 1050 / 1000 = 105%
    expect(result.budgetExceeded).toBe(true)
    expect(result.withinBudget).toBe(false)
  })

  it('respects a company-configured warning/block percentage instead of the default', async () => {
    mockEvent(1000, 500)
    mockRuleFindFirst.mockResolvedValue({ config: { warningPercent: 50, blockPercent: 60 } })
    // projected 550 / 1000 = 55% — above the custom 50% warning, below default 80%
    const result = await checkEventBudget('company-1', 'ev-1', 50)
    expect(result.warningTriggered).toBe(true)
    expect(result.budgetExceeded).toBe(false)
  })

  it('treats a zero budget as unbounded (never warns or blocks)', async () => {
    mockEvent(0, 0)
    const result = await checkEventBudget('company-1', 'ev-1', 5000)
    expect(result.warningTriggered).toBe(false)
    expect(result.budgetExceeded).toBe(false)
  })
})
