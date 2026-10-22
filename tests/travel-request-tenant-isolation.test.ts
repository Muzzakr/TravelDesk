/**
 * @jest-environment node
 *
 * A SYSTEM_ADMIN's employeeId/managerId, and an approver's agentId/managerId
 * reassignment, used to flow straight from the request body into a write
 * with no check that the referenced user belongs to the caller's company —
 * a cross-tenant IDOR. These tests pin the fix: any such id must resolve
 * to a user in the caller's own company, or the request is rejected before
 * anything is written.
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/audit', () => ({ writeAuditLog: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/notifications', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/notify', () => ({
  notifyTravelRequestCreated: jest.fn().mockResolvedValue(undefined),
  notifyTravelRequestStatusChanged: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/mail', () => ({
  emailRequestConfirmation: jest.fn().mockResolvedValue(undefined),
  emailPendingManagerApproval: jest.fn().mockResolvedValue(undefined),
  emailTravelerAssigned: jest.fn().mockResolvedValue(undefined),
  emailRequestApproved: jest.fn().mockResolvedValue(undefined),
  emailRequestRejected: jest.fn().mockResolvedValue(undefined),
  emailAgentActionRequired: jest.fn().mockResolvedValue(undefined),
  emailTravelRequestUpdated: jest.fn().mockResolvedValue(undefined),
  emailTravelRequestCancelled: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/profile-check', () => ({ getProfileStatus: jest.fn().mockResolvedValue({ complete: true }) }))
jest.mock('@/lib/policy-engine', () => ({ checkEventBudget: jest.fn().mockResolvedValue({ budgetExceeded: false }) }))
jest.mock('@/lib/routing-engine', () => ({ determineRoutingPath: jest.fn().mockReturnValue('AGENT_FIRST') }))
jest.mock('@/lib/webhooks', () => ({ dispatchWebhookEvent: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/rate-limit', () => ({ rateLimit: jest.fn().mockResolvedValue(true), clientIp: jest.fn().mockReturnValue('127.0.0.1') }))

jest.mock('@/lib/prisma', () => {
  const makeModel = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({ id: 'tr-1' }),
    delete: jest.fn().mockResolvedValue({}),
  })
  const models: Record<string, ReturnType<typeof makeModel>> = {}
  const prisma: unknown = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === '$transaction') return jest.fn(async (arg: unknown) => (arg as (p: unknown) => unknown)(prisma))
      if (!models[prop]) models[prop] = makeModel()
      return models[prop]
    },
  })
  return { prisma }
})

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = auth as unknown as jest.Mock
const COMPANY_A = 'company-A'
const COMPANY_B = 'company-B'

function signInAs(role: string, companyId = COMPANY_A) {
  mockAuth.mockResolvedValue({ user: { id: 'actor-1', companyId, role, name: 'Actor', email: 'actor@a.com' } })
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

const BASE_CREATE_BODY = {
  eventId: 'event-1',
  origin: 'NYC',
  destination: 'LAX',
  travelDates: { departureDate: '2026-12-01', returnDate: '2026-12-05' },
  servicesRequested: ['FLIGHT'],
  purpose: 'Conference',
}

describe('POST /api/travel-requests — tenant isolation on employeeId/managerId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.event.findFirst as jest.Mock).mockResolvedValue({ id: 'event-1', eventName: 'Q4', ownerUserId: 'actor-1' })
  })

  it('rejects an employeeId belonging to a different company', async () => {
    signInAs('SYSTEM_ADMIN', COMPANY_A)
    // The cross-company lookup, scoped by companyId, correctly finds nothing.
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    const { POST } = await import('@/app/api/travel-requests/route')
    const res = await POST(jsonRequest('/api/travel-requests', 'POST', {
      ...BASE_CREATE_BODY, employeeId: 'victim-in-company-B',
    }))

    expect(res.status).toBe(400)
    expect(prisma.travelRequest.create).not.toHaveBeenCalled()
    // The lookup must have been scoped by the caller's company
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'victim-in-company-B', companyId: COMPANY_A }) })
    )
  })

  it('rejects a managerId belonging to a different company', async () => {
    signInAs('EMPLOYEE', COMPANY_A)
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    const { POST } = await import('@/app/api/travel-requests/route')
    const res = await POST(jsonRequest('/api/travel-requests', 'POST', {
      ...BASE_CREATE_BODY, managerId: 'manager-in-company-B',
    }))

    expect(res.status).toBe(400)
    expect(prisma.travelRequest.create).not.toHaveBeenCalled()
  })

  it('allows a same-company employeeId and managerId through', async () => {
    signInAs('SYSTEM_ADMIN', COMPANY_A)
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'real-employee', managerId: null })

    const { POST } = await import('@/app/api/travel-requests/route')
    const res = await POST(jsonRequest('/api/travel-requests', 'POST', {
      ...BASE_CREATE_BODY, employeeId: 'real-employee', managerId: 'real-manager',
    }))

    expect(res.status).toBe(201)
    expect(prisma.travelRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ employeeId: 'real-employee', companyId: COMPANY_A }) })
    )
  })
})

describe('PATCH /api/travel-requests/[id] — tenant isolation + authz on agentId/managerId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects reassignment from a non-approver role even with no status field', async () => {
    signInAs('EMPLOYEE', COMPANY_A)
    ;(prisma.travelRequest.findFirst as jest.Mock).mockResolvedValue({
      id: 'tr-1', companyId: COMPANY_A, employeeId: 'someone-else', status: 'PENDING_MANAGER',
      employee: { name: 'E', email: 'e@a.com' },
    })

    const { PATCH } = await import('@/app/api/travel-requests/[id]/route')
    const res = await PATCH(jsonRequest('/api/travel-requests/tr-1', 'PATCH', { agentId: 'arbitrary-user' }), { params: { id: 'tr-1' } })

    expect(res.status).toBe(403)
    expect(prisma.travelRequest.update).not.toHaveBeenCalled()
  })

  it('rejects an agentId belonging to a different company, even from an approver', async () => {
    signInAs('MANAGER', COMPANY_A)
    ;(prisma.travelRequest.findFirst as jest.Mock).mockResolvedValue({
      id: 'tr-1', companyId: COMPANY_A, employeeId: 'emp-1', status: 'PENDING_MANAGER',
      employee: { name: 'E', email: 'e@a.com' },
    })
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null) // agent not found in this company

    const { PATCH } = await import('@/app/api/travel-requests/[id]/route')
    const res = await PATCH(jsonRequest('/api/travel-requests/tr-1', 'PATCH', { agentId: 'agent-in-company-B' }), { params: { id: 'tr-1' } })

    expect(res.status).toBe(400)
    expect(prisma.travelRequest.update).not.toHaveBeenCalled()
  })

  it('allows a same-company agentId from an approver', async () => {
    signInAs('MANAGER', COMPANY_A)
    ;(prisma.travelRequest.findFirst as jest.Mock).mockResolvedValue({
      id: 'tr-1', companyId: COMPANY_A, employeeId: 'emp-1', status: 'PENDING_MANAGER',
      employee: { name: 'E', email: 'e@a.com' },
    })
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'real-agent' })
    ;(prisma.travelRequest.update as jest.Mock).mockResolvedValue({ id: 'tr-1', agentId: 'real-agent' })

    const { PATCH } = await import('@/app/api/travel-requests/[id]/route')
    const res = await PATCH(jsonRequest('/api/travel-requests/tr-1', 'PATCH', { agentId: 'real-agent' }), { params: { id: 'tr-1' } })

    expect(res.status).toBe(200)
    expect(prisma.travelRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ agentId: 'real-agent' }) })
    )
  })
})
