export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

// Requests are created directly in PENDING_MANAGER (or PENDING_AGENT) —
// there is no SUBMITTED state at runtime.
const TRAVEL_STEPS = [
  { status: 'PENDING_MANAGER', label: 'Pending Manager Review', description: 'Awaiting manager decision', actor: 'Manager', color: 'border-yellow-200 bg-yellow-50' },
  { status: 'APPROVED', label: 'Reviewed by Manager', description: 'Manager approved', actor: 'Manager', color: 'border-green-200 bg-green-50' },
  { status: 'PENDING_AGENT', label: 'Assigned to Agent', description: 'Travel agent working on booking', actor: 'Agent', color: 'border-purple-200 bg-purple-50' },
  { status: 'OPTIONS_PROVIDED', label: 'Ready to Book', description: 'Options provided, awaiting selection', actor: 'Employee', color: 'border-indigo-200 bg-indigo-50' },
  { status: 'BOOKING_CONFIRMED', label: 'Booked', description: 'Booking confirmed', actor: 'Agent', color: 'border-gray-200 bg-gray-50' },
]

const EXPENSE_STEPS = [
  { status: 'SUBMITTED', label: 'Submitted', description: 'Employee submits expense', actor: 'Employee', color: 'border-blue-200 bg-blue-50' },
  { status: 'UNDER_REVIEW', label: 'Pending Manager Review', description: 'Awaiting manager decision', actor: 'Manager', color: 'border-yellow-200 bg-yellow-50' },
  { status: 'APPROVED', label: 'Approved — Awaiting Payout', description: 'Included in the next payout report', actor: 'Finance', color: 'border-green-200 bg-green-50' },
  { status: 'PAID', label: 'Paid', description: 'Payment processed', actor: 'Finance', color: 'border-gray-200 bg-gray-50' },
]

export default async function WorkflowsPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const [travelByStatus, expenseByStatus] = await Promise.all([
    prisma.travelRequest.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
    }),
    prisma.expense.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
    }),
  ])

  const travelCounts: Record<string, number> = {}
  travelByStatus.forEach((r) => { travelCounts[r.status] = r._count })

  const expenseCounts: Record<string, number> = {}
  expenseByStatus.forEach((r) => { expenseCounts[r.status] = r._count })

  const pendingTravel = await prisma.travelRequest.findMany({
    where: { companyId, status: 'PENDING_MANAGER' },
    include: { employee: { select: { name: true } }, event: { select: { eventName: true } } },
    orderBy: { createdAt: 'asc' },
    take: 5,
  })

  const pendingExpenses = await prisma.expense.findMany({
    where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 5,
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of travel and expense approval workflows</p>
      </div>

      {/* Travel Request Workflow */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Travel Request Workflow</h2>
          <Link href="/manager/team-travel" className="text-sm text-indigo-600 hover:underline">View all →</Link>
        </div>

        {/* Steps */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-start gap-3 min-w-max">
            {TRAVEL_STEPS.map((step, i) => {
              const count = travelCounts[step.status] ?? 0
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className={`rounded-xl border px-4 py-3 w-40 ${step.color}`}>
                    <p className="text-xs font-semibold text-gray-700">{step.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{step.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">By: {step.actor}</p>
                    {count > 0 && (
                      <span className="mt-2 inline-flex items-center rounded-full bg-white border px-2 py-0.5 text-xs font-semibold text-gray-700">
                        {count}
                      </span>
                    )}
                  </div>
                  {i < TRAVEL_STEPS.length - 1 && (
                    <div className="flex items-center mt-6">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Manager Actions: pending travel */}
        {pendingTravel.length > 0 && (
          <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm font-semibold text-yellow-800 mb-3">
              {pendingTravel.length} travel request{pendingTravel.length > 1 ? 's' : ''} awaiting your review
            </p>
            <div className="space-y-2">
              {pendingTravel.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-white border border-yellow-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.employee.name} · {r.origin} → {r.destination}</p>
                    <p className="text-xs text-gray-500">{r.event.eventName}</p>
                  </div>
                  <Link href={`/manager/approvals/travel/${r.id}`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                    Review
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Expense Workflow */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Expense Workflow</h2>
          <Link href="/manager/team-spend" className="text-sm text-indigo-600 hover:underline">View all →</Link>
        </div>

        {/* Steps */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-start gap-3 min-w-max">
            {EXPENSE_STEPS.map((step, i) => {
              const count = expenseCounts[step.status] ?? 0
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className={`rounded-xl border px-4 py-3 w-40 ${step.color}`}>
                    <p className="text-xs font-semibold text-gray-700">{step.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{step.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">By: {step.actor}</p>
                    {count > 0 && i < 3 && (
                      <span className="mt-2 inline-flex items-center rounded-full bg-white border px-2 py-0.5 text-xs font-semibold text-gray-700">
                        {count}
                      </span>
                    )}
                  </div>
                  {i < EXPENSE_STEPS.length - 1 && (
                    <div className="flex items-center mt-6">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Manager Actions: pending expenses */}
        {pendingExpenses.length > 0 && (
          <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm font-semibold text-yellow-800 mb-3">
              {pendingExpenses.length} expense{pendingExpenses.length > 1 ? 's' : ''} awaiting your review
            </p>
            <div className="space-y-2">
              {pendingExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-white border border-yellow-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{e.employee.name} · {e.description}</p>
                    <p className="text-xs text-gray-500">${Number(e.amountUsd).toFixed(2)}</p>
                  </div>
                  <Link href={`/manager/approvals/expense/${e.id}`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                    Review
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Status Summary */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Status Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Travel Requests</h3>
            <div className="space-y-2">
              {Object.entries(travelCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <Badge variant={statusToBadgeVariant(status)}>{status.replace(/_/g, ' ')}</Badge>
                  <span className="text-sm font-semibold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(travelCounts).length === 0 && (
                <p className="text-sm text-gray-400">No data</p>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Expenses</h3>
            <div className="space-y-2">
              {Object.entries(expenseCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <Badge variant={statusToBadgeVariant(status)}>{status.replace(/_/g, ' ')}</Badge>
                  <span className="text-sm font-semibold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(expenseCounts).length === 0 && (
                <p className="text-sm text-gray-400">No data</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
