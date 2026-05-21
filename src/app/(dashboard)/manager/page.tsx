import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function ManagerDashboard() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId
  const [pendingRequests, pendingExpenses, activeEvents] = await Promise.all([
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
    prisma.event.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true, eventName: true, eventCode: true, budgetUsd: true, approvedSpendUsd: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Manager dashboard</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending travel requests</p>
          <p className="mt-1 text-3xl font-bold text-yellow-600">{pendingRequests.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending expenses</p>
          <p className="mt-1 text-3xl font-bold text-yellow-600">{pendingExpenses.length}</p>
        </div>
      </div>

      {/* Pending travel requests */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Pending travel requests</h2>
        {pendingRequests.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No pending travel requests.</div>
        ) : (
          <>
            {/* Mobile */}
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
            {/* Desktop */}
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
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Pending expenses</h2>
        {pendingExpenses.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No pending expenses.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {pendingExpenses.map((ex) => (
                <div key={ex.id} className="rounded-xl border bg-white px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{ex.employee.name}</p>
                    <p className="font-semibold text-gray-900">${Number(ex.amountUsd).toFixed(2)}</p>
                  </div>
                  <p className="text-sm text-gray-700 truncate">{ex.description}</p>
                  <Link href={`/manager/approvals/expense/${ex.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Review →</Link>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-hidden rounded-xl border bg-white">
              <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingExpenses.map((ex) => (
                    <tr key={ex.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{ex.employee.name}</td>
                      <td className="px-4 py-3 text-gray-700">{ex.description}</td>
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

      {/* Event budgets */}
      {activeEvents.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Event budgets</h2>
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-right">Budget</th>
                  <th className="px-4 py-3 text-right">Used</th>
                  <th className="px-4 py-3 text-right">Remaining</th>
                  <th className="px-4 py-3 text-left w-40">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeEvents.map((ev) => {
                  const budget   = Number(ev.budgetUsd)
                  const used     = Number(ev.approvedSpendUsd)
                  const remaining = budget - used
                  const pct      = budget > 0 ? Math.min(Math.round((used / budget) * 100), 100) : 0
                  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
                  return (
                    <tr key={ev.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{ev.eventName}</p>
                        <p className="text-xs text-gray-400 font-mono">{ev.eventCode}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">${budget.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">${used.toLocaleString('en-US')}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${remaining < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {remaining < 0 ? '-' : ''}${Math.abs(remaining).toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            {/* eslint-disable-next-line react/forbid-component-props */}
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs font-medium w-8 text-right ${pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-yellow-600' : 'text-gray-500'}`}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
