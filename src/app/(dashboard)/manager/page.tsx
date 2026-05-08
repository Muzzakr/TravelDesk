export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  TRANSPORT:     { label: 'Travel & Transport',     icon: '✈️',  color: 'bg-blue-500' },
  ACCOMMODATION: { label: 'Accommodation',           icon: '🏨',  color: 'bg-purple-500' },
  MEALS:         { label: 'Meals & Daily Expenses',  icon: '🍽️', color: 'bg-orange-500' },
  SUPPLIES:      { label: 'Supplies',                icon: '📦',  color: 'bg-teal-500' },
  OTHER:         { label: 'Other',                   icon: '📋',  color: 'bg-gray-400' },
}

export default async function ManagerDashboard() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const [pendingRequests, pendingExpenses, expensesByCategory, totalApproved, totalPending, topSpenders] = await Promise.all([
    prisma.travelRequest.findMany({
      where: { companyId, status: 'PENDING_MANAGER' },
      include: { employee: { select: { name: true } }, event: { select: { eventName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      include: { employee: { select: { name: true } }, event: { select: { eventName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.groupBy({
      by: ['category'],
      where: { companyId, status: { in: ['APPROVED', 'PAID'] } },
      _sum: { amountUsd: true },
      orderBy: { _sum: { amountUsd: 'desc' } },
    }),
    prisma.expense.aggregate({
      where: { companyId, status: { in: ['APPROVED', 'PAID'] } },
      _sum: { amountUsd: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      _sum: { amountUsd: true },
    }),
    prisma.expense.groupBy({
      by: ['employeeId'],
      where: { companyId, status: { in: ['APPROVED', 'PAID'] } },
      _sum: { amountUsd: true },
      orderBy: { _sum: { amountUsd: 'desc' } },
      take: 5,
    }),
  ])

  const approvedTotal = Number(totalApproved._sum.amountUsd ?? 0)
  const pendingTotal = Number(totalPending._sum.amountUsd ?? 0)
  const maxCategory = Math.max(...expensesByCategory.map((c) => Number(c._sum.amountUsd ?? 0)), 1)

  const spenderIds = topSpenders.map((s) => s.employeeId)
  const spenderUsers = spenderIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: spenderIds } }, select: { id: true, name: true } })
    : []
  const nameMap = Object.fromEntries(spenderUsers.map((u) => [u.id, u.name]))

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Manager dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending travel</p>
          <p className="mt-1 text-3xl font-bold text-yellow-600">{pendingRequests.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending expenses</p>
          <p className="mt-1 text-3xl font-bold text-yellow-600">{pendingExpenses.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Approved spend</p>
          <p className="mt-1 text-3xl font-bold text-green-600">${approvedTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Awaiting approval</p>
          <p className="mt-1 text-3xl font-bold text-orange-500">${pendingTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Spend by category + Top spenders side by side on desktop */}
      {(expensesByCategory.length > 0 || topSpenders.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Spend by category */}
          {expensesByCategory.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-800">Spend by category</h2>
              <div className="rounded-xl border bg-white p-5 space-y-4 h-full">
                {expensesByCategory.map((cat) => {
                  const amount = Number(cat._sum.amountUsd ?? 0)
                  const pct = (amount / maxCategory) * 100
                  const meta = CATEGORY_META[cat.category] ?? { label: cat.category, icon: '📋', color: 'bg-gray-400' }
                  return (
                    <div key={cat.category}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-gray-700">{meta.icon} {meta.label}</span>
                        <span className="text-gray-500 font-semibold">${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div className={`h-2 rounded-full ${meta.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Top spenders */}
          {topSpenders.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-800">Top spenders</h2>
              <div className="rounded-xl border bg-white overflow-hidden">
                <table className="w-full text-sm divide-y divide-gray-100">
                  <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-right">Approved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {topSpenders.map((s, i) => (
                      <tr key={s.employeeId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <span className="inline-block w-5 text-center text-xs text-gray-400 mr-1">{i + 1}.</span>
                          {nameMap[s.employeeId] ?? 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">
                          ${Number(s._sum.amountUsd ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Pending travel requests */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Pending travel requests</h2>
          {pendingRequests.length > 0 && (
            <Link href="/manager/approvals" className="text-sm font-medium text-indigo-600 hover:underline">View all →</Link>
          )}
        </div>
        {pendingRequests.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No pending travel requests.</div>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {pendingRequests.map((r) => (
                <div key={r.id} className="rounded-xl border bg-white px-4 py-3 space-y-1.5">
                  <p className="font-medium text-gray-900">{r.employee.name}</p>
                  <p className="text-sm text-gray-600">{r.origin} → {r.destination}</p>
                  <p className="text-xs text-gray-400">{r.event.eventName}</p>
                  {r.estimatedCostUsd && <p className="text-sm font-semibold text-gray-900">${Number(r.estimatedCostUsd).toFixed(0)}</p>}
                  <Link href={`/manager/approvals/travel/${r.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Review →</Link>
                </div>
              ))}
            </div>
            <div className="hidden sm:block overflow-hidden rounded-xl border bg-white">
              <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Route</th>
                    <th className="px-4 py-3 text-left">Event</th>
                    <th className="px-4 py-3 text-left">Est. cost</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.employee.name}</td>
                      <td className="px-4 py-3">{r.origin} → {r.destination}</td>
                      <td className="px-4 py-3 text-gray-500">{r.event.eventName}</td>
                      <td className="px-4 py-3">{r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(0)}` : '—'}</td>
                      <td className="px-4 py-3">
                        <Link href={`/manager/approvals/travel/${r.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Review</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Pending expenses */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Pending expenses</h2>
          {pendingExpenses.length > 0 && (
            <Link href="/manager/approvals" className="text-sm font-medium text-indigo-600 hover:underline">View all →</Link>
          )}
        </div>
        {pendingExpenses.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No pending expenses.</div>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {pendingExpenses.map((ex) => (
                <div key={ex.id} className="rounded-xl border bg-white px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{ex.employee.name}</p>
                    <p className="font-semibold text-gray-900">${Number(ex.amountUsd).toFixed(2)}</p>
                  </div>
                  <p className="text-sm text-gray-700 truncate">{ex.description}</p>
                  <p className="text-xs text-gray-400">{ex.event.eventName}</p>
                  <Link href={`/manager/approvals/expense/${ex.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Review →</Link>
                </div>
              ))}
            </div>
            <div className="hidden sm:block overflow-hidden rounded-xl border bg-white">
              <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Event</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingExpenses.map((ex) => (
                    <tr key={ex.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{ex.employee.name}</td>
                      <td className="px-4 py-3 text-gray-700">{ex.description}</td>
                      <td className="px-4 py-3 text-gray-500">{ex.event.eventName}</td>
                      <td className="px-4 py-3">${Number(ex.amountUsd).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/manager/approvals/expense/${ex.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Review</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
