/**
 * @jest-environment node
 *
 * "Ask Admin" on expenses: a Manager/Travel Manager can hand a
 * trivial-but-uncertain expense to a System Admin for a second
 * opinion instead of guessing, mirroring the existing travel-request
 * escalation. Auth/Prisma/side effects are mocked — no database.
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/audit', () => ({ writeAuditLog: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/notify', () => ({ notifyExpenseStatusChanged: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/notifications', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/mail', () => ({
  emailExpenseApproved: jest.fn().mockResolvedValue(undefined),
  emailExpenseRejected: jest.fn().mockResolvedValue(undefined),
  emailExpenseToFinance: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/rate-limit', () => ({ clientIp: jest.fn().mockReturnValue('127.0.0.1') }))
jest.mock('@/lib/prisma', () => {
  const makeModel = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
  })
  const models: Record<string | symbol, ReturnType<typeof makeModel>> = {}
  const prisma: unknown = new Proxy({}, {
    get(_target, prop) {
      if (prop === '$transaction') {
        return jest.fn(async (arg: unknown) =>
          (arg as (p: unknown) => unknown)(prisma))
      }
      if (!models[prop]) models[prop] = makeModel()
      return models[prop]
    },
  })
  return { prisma }
})

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { PATCH } from '@/app/api/expenses/[id]/route'

const mockAuth = auth as unknown as jest.Mock
const mockExpenseFindFirst = prisma.expense.findFirst as jest.Mock
const mockApprovalActionCreate = prisma.approvalAction.create as jest.Mock
const mockUserFindMany = prisma.user.findMany as jest.Mock
const mockCreateNotification = createNotification as jest.Mock

const BASE_EXPENSE = {
  id: 'exp-1',
  companyId: 'company-1',
  employeeId: 'emp-1',
  eventId: 'ev-1',
  status: 'SUBMITTED',
  amountUsd: 42,
  description: 'Taxi receipt',
  employee: { name: 'Ada', email: 'ada@example.com' },
  event: { eventCode: 'C1', eventName: 'Conf' },
}

function signInAs(role: string) {
  mockAuth.mockResolvedValue({ user: { id: 'actor-1', companyId: 'company-1', name: 'Actor', role } })
}

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/expenses/exp-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const call = (body: unknown) => PATCH(patchRequest(body), { params: { id: 'exp-1' } })

describe('PATCH /api/expenses/[id] — Ask Admin escalation', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockExpenseFindFirst.mockReset()
    mockApprovalActionCreate.mockReset()
    mockUserFindMany.mockReset()
    mockCreateNotification.mockReset()
    mockExpenseFindFirst.mockResolvedValue(BASE_EXPENSE)
    mockUserFindMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }])
  })

  it('rejects the request when the escalation note is missing', async () => {
    signInAs('MANAGER')
    const res = await call({ status: 'PENDING_ADMIN' })
    expect(res.status).toBe(400)
  })

  it('rejects the request when the escalation note is blank', async () => {
    signInAs('MANAGER')
    const res = await call({ status: 'PENDING_ADMIN', adminEscalationNote: '   ' })
    expect(res.status).toBe(400)
  })

  it.each(['MANAGER', 'TRAVEL_MANAGER'])('lets %s escalate with a reason', async (role) => {
    signInAs(role)
    const res = await call({ status: 'PENDING_ADMIN', adminEscalationNote: 'Looks like a duplicate charge' })
    expect(res.status).toBe(200)

    // Logged as ESCALATE, not APPROVE/REJECT
    expect(mockApprovalActionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actionType: 'ESCALATE', note: 'Looks like a duplicate charge' }),
    }))
  })

  it.each(['FINANCE_ADMIN', 'SYSTEM_ADMIN', 'EMPLOYEE'])('refuses %s trying to escalate', async (role) => {
    signInAs(role)
    const res = await call({ status: 'PENDING_ADMIN', adminEscalationNote: 'Why?' })
    expect(res.status).toBe(403)
    expect(mockApprovalActionCreate).not.toHaveBeenCalled()
  })

  it('notifies every active System Admin in the company, not other roles', async () => {
    signInAs('TRAVEL_MANAGER')
    await call({ status: 'PENDING_ADMIN', adminEscalationNote: 'Need a second opinion' })

    expect(mockUserFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'company-1', role: 'SYSTEM_ADMIN', isActive: true }),
    }))
    expect(mockCreateNotification).toHaveBeenCalledTimes(2)
    expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      href: '/manager/approvals/expense/exp-1',
    }))
  })

  it('still refuses to modify a PAID expense even when escalating', async () => {
    mockExpenseFindFirst.mockResolvedValue({ ...BASE_EXPENSE, status: 'PAID' })
    signInAs('MANAGER')
    const res = await call({ status: 'PENDING_ADMIN', adminEscalationNote: 'Too late but trying' })
    expect(res.status).toBe(403)
  })
})
