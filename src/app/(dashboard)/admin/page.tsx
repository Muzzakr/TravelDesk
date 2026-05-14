export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { WebhookCard } from '@/components/ui/WebhookCard'

const roleBadge: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
  EMPLOYEE: 'blue',
  MANAGER: 'green',
  TRAVEL_AGENT: 'purple',
  FINANCE_ADMIN: 'yellow',
  SYSTEM_ADMIN: 'gray',
}


export default async function AdminDashboard() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const [
    users, recentAudit, eventCount, allEvents,
    pendingRequests, approvedSpend, pendingSpend,
    pendingPayoutExpenses, payoutReports,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { actor: { select: { name: true } } },
    }),
    prisma.event.count({ where: { companyId } }),
    prisma.event.findMany({
      where: { companyId },
      select: { id: true, eventCode: true, eventName: true, status: true, budgetUsd: true, approvedSpendUsd: true, eventDate: true },
      orderBy: [{ eventDate: 'asc' }, { eventCode: 'asc' }],
    }),
    prisma.travelRequest.count({
      where: { companyId, status: { in: ['PENDING_AGENT', 'PENDING_MANAGER', 'OPTIONS_PROVIDED'] } },
    }),
    prisma.expense.aggregate({
      where: { companyId, status: { in: ['APPROVED', 'PAID'] } },
      _sum: { amountUsd: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      _sum: { amountUsd: true },
    }),
    prisma.expense.findMany({
      where: { companyId, status: 'APPROVED', payoutReportId: null },
      include: {
        employee: { select: { name: true } },
        event: { select: { eventName: true, eventCode: true } },
        receipts: { select: { id: true, fileName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payoutReport.findMany({
      where: { companyId },
      orderBy: { generatedAt: 'desc' },
      take: 10,
    }),
  ])

  const totalApproved = Number(approvedSpend._sum.amountUsd ?? 0)
  const totalPending = Number(pendingSpend._sum.amountUsd ?? 0)
  const totalPendingPayout = pendingPayoutExpenses.reduce((s, e) => s + Number(e.amountUsd), 0)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Admin dashboard</h1>

      {/* Top stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total users</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{users.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active users</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{users.filter((u) => u.isActive).length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Events</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{eventCount}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Open travel requests</p>
          <p className="mt-1 text-3xl font-bold text-orange-500">{pendingRequests}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/admin/users" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Manage users
        </Link>
        <Link href="/admin/events" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Manage events
        </Link>
        <Link href="/admin/accounts" className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
          View all accounts
        </Link>
        <Link href="/admin/book" className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
          + Create request
        </Link>
      </div>

      {/* Spend overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Approved, awaiting payout</p>
          <p className="mt-1 text-3xl font-bold text-green-600">${totalPendingPayout.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Approved spend (total)</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">${totalApproved.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending approval</p>
          <p className="mt-1 text-3xl font-bold text-yellow-500">${totalPending.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Pending expenses — awaiting payout */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Pending expenses — awaiting payout</h2>
          {pendingPayoutExpenses.length > 0 && (
            <span className="text-sm text-gray-500">
              {pendingPayoutExpenses.length} expense{pendingPayoutExpenses.length > 1 ? 's' : ''} · ${totalPendingPayout.toFixed(2)} total
            </span>
          )}
        </div>
        {pendingPayoutExpenses.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No approved expenses pending payout.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {pendingPayoutExpenses.map((e) => (
                <div key={e.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{e.employee.name}</p>
                      <p className="text-xs text-gray-400">{e.category.replace(/_/g, ' ')} · {e.merchantName ?? '—'}</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">${Number(e.amountUsd).toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    <span className="font-mono text-gray-400 mr-1">{e.event.eventCode}</span>
                    {e.event.eventName}
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    {e.receipts.length > 0 ? (
                      <Link href={`/manager/approvals/expense/${e.id}`} className="text-xs font-medium text-indigo-600 hover:underline">
                        📎 {e.receipts.length} receipt{e.receipts.length > 1 ? 's' : ''} — View →
                      </Link>
                    ) : (
                      <span className="text-xs text-orange-500 font-medium">⚠ No receipt</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-[750px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Event</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Merchant</th>
                    <th className="px-4 py-3 text-left">Receipts</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingPayoutExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{e.employee.name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        <span className="font-mono text-xs text-gray-400 mr-1">{e.event.eventCode}</span>
                        {e.event.eventName}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{e.category.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-gray-500">{e.merchantName ?? '—'}</td>
                      <td className="px-4 py-3">
                        {e.receipts.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                            ✓ {e.receipts.length} receipt{e.receipts.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 rounded-full px-2 py-0.5">
                            ⚠ Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">${Number(e.amountUsd).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/manager/approvals/expense/${e.id}`} className="text-xs font-medium text-indigo-600 hover:underline">
                          View receipts →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">Total to reimburse</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-green-700">${totalPendingPayout.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Link href="/finance/payout-reports" className="text-xs font-medium text-green-700 hover:underline">
                        Generate payout →
                      </Link>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Event budgets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Event budgets</h2>
          <Link href="/finance/events" className="text-sm font-medium text-indigo-600 hover:underline">Manage budgets →</Link>
        </div>
        {allEvents.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No events found.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {allEvents.map((ev) => {
                const budget = Number(ev.budgetUsd)
                const spent = Number(ev.approvedSpendUsd)
                const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
                const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                return (
                  <div key={ev.id} className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{ev.eventName}</p>
                        <p className="text-xs font-mono text-gray-400">{ev.eventCode}</p>
                      </div>
                      <Badge variant={statusToBadgeVariant(ev.status)}>{ev.status}</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Spent: <span className="font-medium text-gray-800">${spent.toFixed(0)}</span></span>
                      <span>Budget: <span className="font-medium text-gray-800">${budget.toFixed(0)}</span> ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-[700px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Event Name</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-right">Budget</th>
                    <th className="px-4 py-3 text-right">Spent</th>
                    <th className="px-4 py-3 text-left w-40">Usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allEvents.map((ev) => {
                    const budget = Number(ev.budgetUsd)
                    const spent = Number(ev.approvedSpendUsd)
                    const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
                    const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                    return (
                      <tr key={ev.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{ev.eventCode}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{ev.eventName}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusToBadgeVariant(ev.status)}>{ev.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">${budget.toFixed(0)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">${spent.toFixed(0)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-gray-100">
                              <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-9 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>


      {/* Payout reports */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Payout reports</h2>
          <Link href="/finance/payout-reports" className="text-sm font-medium text-indigo-600 hover:underline">View all →</Link>
        </div>
        {payoutReports.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No payout reports yet.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {payoutReports.map((r) => (
                <div key={r.id} className="rounded-xl border bg-white px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(r.periodStart).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} – {new Date(r.periodEnd).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                    </p>
                    <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xl font-bold text-gray-900">${Number(r.totalUsd).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">Generated {new Date(r.generatedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-hidden rounded-xl border bg-white">
              <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-left">Total</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payoutReports.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {new Date(r.periodStart).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} – {new Date(r.periodEnd).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">${Number(r.totalUsd).toFixed(2)}</td>
                      <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-4 py-3 text-gray-400">{new Date(r.generatedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Users */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Users</h2>
          <Link href="/admin/users" className="text-sm font-medium text-indigo-600 hover:underline">Manage →</Link>
        </div>
        <div className="sm:hidden space-y-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl border bg-white px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{u.name}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant={roleBadge[u.role] ?? 'gray'}>{u.role.replace(/_/g, ' ')}</Badge>
                <Badge variant={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-[500px] w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{u.email}</td>
                  <td className="px-4 py-3"><Badge variant={roleBadge[u.role] ?? 'gray'}>{u.role.replace(/_/g, ' ')}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Webhook integration */}
      <WebhookCard />

      {/* Audit log */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Audit log (recent)</h2>
          <Link href="/admin/audit-log" className="text-sm font-medium text-indigo-600 hover:underline">View all →</Link>
        </div>
        <div className="sm:hidden space-y-2">
          {recentAudit.map((log) => (
            <div key={log.id} className="rounded-xl border bg-white px-4 py-3 space-y-1">
              <p className="font-mono text-xs font-medium text-gray-800">{log.action}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{log.entityType} · {log.actor?.name ?? 'System'}</span>
                <span>{new Date(log.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-[500px] w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Actor</th>
                <th className="px-4 py-3 text-left">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentAudit.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{log.action}</td>
                  <td className="px-4 py-3 text-gray-500">{log.entityType}</td>
                  <td className="px-4 py-3 text-gray-500">{log.actor?.name ?? 'System'}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
