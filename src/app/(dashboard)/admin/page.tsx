import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/Badge'
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

  const [users, recentAudit, eventCount, activeEvents, expensesByCategory, pendingRequests, approvedSpend, pendingSpend] = await Promise.all([
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
      select: { eventCode: true, eventName: true, status: true, budgetUsd: true, approvedSpendUsd: true, eventDate: true },
      orderBy: { eventDate: { sort: 'asc', nulls: 'last' } },
      take: 12,
    }),
    prisma.expense.groupBy({
      by: ['category'],
      where: { companyId, status: { in: ['APPROVED', 'PAID'] } },
      _sum: { amountUsd: true },
      orderBy: { _sum: { amountUsd: 'desc' } },
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
  ])

  const totalApproved = Number(approvedSpend._sum.amountUsd ?? 0)
  const totalPending = Number(pendingSpend._sum.amountUsd ?? 0)
  const maxCategory = Math.max(...expensesByCategory.map((c) => Number(c._sum.amountUsd ?? 0)), 1)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Admin dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>

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
      </div>

      {/* Spend overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Approved spend</p>
          <p className="mt-1 text-3xl font-bold text-green-600">${totalApproved.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending expenses</p>
          <p className="mt-1 text-3xl font-bold text-yellow-500">${totalPending.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Open travel requests</p>
          <p className="mt-1 text-3xl font-bold text-orange-500">{pendingRequests}</p>
        </div>
      </div>

      {/* Event budget tracker */}
      {activeEvents.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Event budget tracker</h2>
          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full text-sm divide-y divide-gray-100">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-left">Budget</th>
                  <th className="px-4 py-3 text-right">Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeEvents.map((ev) => {
                  const budget = Number(ev.budgetUsd ?? 0)
                  const used = Number(ev.approvedSpendUsd ?? 0)
                  const pct = budget > 0 ? Math.min((used / budget) * 100, 100) : 0
                  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
                  return (
                    <tr key={ev.eventCode} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[180px]">{ev.eventName}</p>
                        <p className="text-xs text-gray-400">{ev.eventCode}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell whitespace-nowrap">
                        {ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                          {ev.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 w-40">
                        {budget > 0 ? (
                          <div className="space-y-1">
                            <div className="h-2 w-full rounded-full bg-gray-100">
                              <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-xs text-gray-400">{Math.round(pct)}% of ${budget.toLocaleString()}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No budget set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700 whitespace-nowrap">
                        ${used.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Spend by category */}
      {expensesByCategory.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Spend by category</h2>
          <div className="rounded-xl border bg-white p-4 space-y-3">
            {expensesByCategory.map((cat) => {
              const amount = Number(cat._sum.amountUsd ?? 0)
              const pct = (amount / maxCategory) * 100
              return (
                <div key={cat.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700 capitalize">{cat.category.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="text-gray-500">${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Users */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Users</h2>
        {/* Mobile cards */}
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
        {/* Desktop table */}
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
        {/* Mobile cards */}
        <div className="sm:hidden space-y-2">
          {recentAudit.map((log) => (
            <div key={log.id} className="rounded-xl border bg-white px-4 py-3 space-y-1">
              <p className="font-mono text-xs font-medium text-gray-800">{log.action}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{log.entityType} · {log.actor?.name ?? 'System'}</span>
                <span>{new Date(log.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop table */}
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
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
