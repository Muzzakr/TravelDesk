/**
 * @jest-environment node
 *
 * Smoke tests for the role guards on the most security-sensitive API
 * routes. They do not test business logic — only that each role is
 * let through or turned away at the door (401/403). Auth, Prisma and
 * all side-effect modules are mocked, so no database is touched.
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/audit', () => ({ writeAuditLog: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/notifications', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/notify', () => ({
  notifyOptionsProvided: jest.fn().mockResolvedValue(undefined),
  notifyTravelRequestStatusChanged: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/mail', () => ({
  emailBookingConfirmed: jest.fn().mockResolvedValue(undefined),
  emailOptionsProvided: jest.fn().mockResolvedValue(undefined),
  emailRequestApproved: jest.fn().mockResolvedValue(undefined),
  emailRequestRejected: jest.fn().mockResolvedValue(undefined),
  emailAgentActionRequired: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue(true),
  clientIp: jest.fn().mockReturnValue('127.0.0.1'),
}))
jest.mock('@/lib/prisma', () => {
  const makeModel = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
    aggregate: jest.fn().mockResolvedValue({ _count: 0, _sum: {} }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  })
  const models: Record<string | symbol, ReturnType<typeof makeModel>> = {}
  const prisma: unknown = new Proxy({}, {
    get(_target, prop) {
      if (prop === '$transaction') {
        return jest.fn(async (arg: unknown) =>
          Array.isArray(arg) ? Promise.all(arg) : (arg as (p: unknown) => unknown)(prisma))
      }
      if (!models[prop]) models[prop] = makeModel()
      return models[prop]
    },
  })
  return { prisma }
})

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = auth as unknown as jest.Mock

const ALL_ROLES = ['EMPLOYEE', 'MANAGER', 'TRAVEL_MANAGER', 'TRAVEL_AGENT', 'FINANCE_ADMIN', 'SYSTEM_ADMIN'] as const

function signInAs(role: string | null) {
  mockAuth.mockResolvedValue(
    role
      ? { user: { id: 'user-1', companyId: 'company-1', role, name: 'Test User', email: 'test@example.com' } }
      : null
  )
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

type RouteCase = {
  name: string
  allowed: readonly string[]
  call: () => Promise<Response>
}

const CASES: RouteCase[] = [
  {
    name: 'GET /api/admin/stats',
    allowed: ['SYSTEM_ADMIN', 'MANAGER', 'TRAVEL_MANAGER'],
    call: async () => {
      const { GET } = await import('@/app/api/admin/stats/route')
      return GET(jsonRequest('/api/admin/stats?period=monthly', 'GET'))
    },
  },
  {
    name: 'GET /api/payout-reports',
    allowed: ['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'],
    call: async () => {
      const { GET } = await import('@/app/api/payout-reports/route')
      return GET()
    },
  },
  {
    name: 'PATCH /api/payout-reports (bulk mark paid)',
    allowed: ['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'],
    call: async () => {
      const { PATCH } = await import('@/app/api/payout-reports/route')
      return PATCH(jsonRequest('/api/payout-reports', 'PATCH', { employeeId: 'emp-1' }))
    },
  },
  {
    name: 'POST /api/finance/expenses/mark-paid',
    allowed: ['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'],
    call: async () => {
      const { POST } = await import('@/app/api/finance/expenses/mark-paid/route')
      return POST(jsonRequest('/api/finance/expenses/mark-paid', 'POST', { expenseId: 'exp-1' }))
    },
  },
  {
    name: 'POST /api/travel-requests/[id]/options (provide booking options)',
    allowed: ['TRAVEL_AGENT', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN', 'EMPLOYEE'],
    call: async () => {
      const { POST } = await import('@/app/api/travel-requests/[id]/options/route')
      return POST(
        jsonRequest('/api/travel-requests/tr-1/options', 'POST', {
          options: [{ serviceType: 'HOTEL', vendor: 'Hilton', description: '2 nights', priceUsd: 100 }],
        }),
        { params: { id: 'tr-1' } }
      )
    },
  },
  {
    name: 'POST /api/travel-requests/[id]/confirm (send booking info)',
    allowed: ['TRAVEL_AGENT', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'],
    call: async () => {
      const { POST } = await import('@/app/api/travel-requests/[id]/confirm/route')
      return POST(
        jsonRequest('/api/travel-requests/tr-1/confirm', 'POST', {
          services: [{ serviceType: 'HOTEL', confirmationNumber: 'ABC-123' }],
        }),
        { params: { id: 'tr-1' } }
      )
    },
  },
  {
    name: 'POST /api/agent/ai-search',
    allowed: ['TRAVEL_AGENT', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN', 'EMPLOYEE'],
    call: async () => {
      const { POST } = await import('@/app/api/agent/ai-search/route')
      return POST(jsonRequest('/api/agent/ai-search', 'POST', { travelRequestId: 'tr-1' }))
    },
  },
]

describe.each(CASES)('$name', ({ allowed, call }) => {
  beforeEach(() => mockAuth.mockReset())

  it('returns 401 when unauthenticated', async () => {
    signInAs(null)
    const res = await call()
    expect(res.status).toBe(401)
  })

  const denied = ALL_ROLES.filter((r) => !allowed.includes(r))

  it.each(denied)('turns away %s', async (role) => {
    signInAs(role)
    const res = await call()
    expect([401, 403]).toContain(res.status)
  })

  it.each([...allowed])('lets %s past the role guard', async (role) => {
    signInAs(role)
    const res = await call()
    // Business logic may still 404/409 on the empty mock DB —
    // the assertion is only that the door was not closed on the role.
    expect([401, 403]).not.toContain(res.status)
  })
})

describe('PATCH /api/travel-requests/[id] (approval)', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    // A pending request owned by someone else must exist for the guard to be reached
    ;(prisma as { travelRequest: { findFirst: jest.Mock } }).travelRequest.findFirst.mockResolvedValue({
      id: 'tr-1',
      companyId: 'company-1',
      employeeId: 'someone-else',
      status: 'PENDING_MANAGER',
      origin: 'Stockholm',
      destination: 'Chicago',
      travelDates: { departureDate: '2026-08-01', returnDate: '2026-08-05' },
      agentId: null,
      confirmationNumber: null,
      employee: { name: 'Owner', email: 'owner@example.com' },
    })
  })

  it('refuses an EMPLOYEE trying to approve', async () => {
    signInAs('EMPLOYEE')
    const { PATCH } = await import('@/app/api/travel-requests/[id]/route')
    const res = await PATCH(
      jsonRequest('/api/travel-requests/tr-1', 'PATCH', { status: 'APPROVED' }),
      { params: { id: 'tr-1' } }
    )
    expect(res.status).toBe(403)
  })

  it.each(['MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'])('lets %s approve', async (role) => {
    signInAs(role)
    const { PATCH } = await import('@/app/api/travel-requests/[id]/route')
    const res = await PATCH(
      jsonRequest('/api/travel-requests/tr-1', 'PATCH', { status: 'APPROVED' }),
      { params: { id: 'tr-1' } }
    )
    expect(res.status).toBe(200)
  })
})
