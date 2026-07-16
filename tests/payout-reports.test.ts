/**
 * @jest-environment node
 *
 * The Payouts page aggregates approved expenses per person and lets
 * a manager pay one employee's approved expenses in bulk. This tests
 * the money math and the blast radius of the bulk-pay action — the
 * two things that are expensive to get wrong.
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/audit', () => ({ writeAuditLog: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/notifications', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, PATCH } from '@/app/api/payout-reports/route'

const mockAuth = auth as unknown as jest.Mock
const mockFindMany = prisma.expense.findMany as jest.Mock
const mockGroupBy = prisma.expense.groupBy as jest.Mock
const mockUpdateMany = prisma.expense.updateMany as jest.Mock

function signInAs(role: string) {
  mockAuth.mockResolvedValue({ user: { id: 'mgr-1', companyId: 'company-1', role } })
}

function jsonRequest(body: unknown) {
  return new NextRequest('http://localhost/api/payout-reports', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/payout-reports', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockFindMany.mockReset()
    mockGroupBy.mockReset()
    signInAs('TRAVEL_MANAGER')
    mockGroupBy.mockResolvedValue([])
  })

  it('groups approved expenses by employee and sums the totals correctly', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'e1', amountUsd: '100.50', category: 'MEALS', description: 'Lunch', merchantName: null, transactionDate: null, createdAt: new Date(), employee: { id: 'emp-1', name: 'Ada' }, event: { eventName: 'Conf', eventCode: 'C1' } },
      { id: 'e2', amountUsd: '49.50', category: 'MEALS', description: 'Dinner', merchantName: null, transactionDate: null, createdAt: new Date(), employee: { id: 'emp-1', name: 'Ada' }, event: { eventName: 'Conf', eventCode: 'C1' } },
      { id: 'e3', amountUsd: '200', category: 'TRANSPORT', description: 'Taxi', merchantName: null, transactionDate: null, createdAt: new Date(), employee: { id: 'emp-2', name: 'Bo' }, event: { eventName: 'Conf', eventCode: 'C1' } },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.totalOutstandingUsd).toBe(350)
    expect(body.people).toHaveLength(2)

    const ada = body.people.find((p: { employeeId: string }) => p.employeeId === 'emp-1')
    expect(ada.count).toBe(2)
    expect(ada.totalUsd).toBe(150) // 100.50 + 49.50, not string-concatenated

    // Highest total sorts first
    expect(body.people[0].employeeId).toBe('emp-2')
  })

  it('returns an empty list, not an error, when nothing is outstanding', async () => {
    mockFindMany.mockResolvedValue([])
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.people).toEqual([])
    expect(body.totalOutstandingUsd).toBe(0)
  })
})

describe('PATCH /api/payout-reports (bulk mark paid)', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockFindMany.mockReset()
    mockUpdateMany.mockReset()
    signInAs('TRAVEL_MANAGER')
  })

  it('rejects an employee with no approved expenses instead of silently succeeding', async () => {
    mockFindMany.mockResolvedValue([])
    const res = await PATCH(jsonRequest({ employeeId: 'emp-1' }))
    expect(res.status).toBe(409)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('only updates the named employee\'s approved expenses, scoped to the company', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'e1', amountUsd: '100' },
      { id: 'e2', amountUsd: '50' },
    ])
    const res = await PATCH(jsonRequest({ employeeId: 'emp-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(2)
    expect(body.totalUsd).toBe(150)

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', employeeId: 'emp-1', status: 'APPROVED' },
      data: { status: 'PAID' },
    })
  })

  it('rejects a plain employee trying to trigger a payout', async () => {
    signInAs('EMPLOYEE')
    const res = await PATCH(jsonRequest({ employeeId: 'emp-1' }))
    expect(res.status).toBe(403)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })
})
