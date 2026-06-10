export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

export default async function TeamTravelPage({
  searchParams,
}: {
  searchParams: { status?: string; employee?: string }
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const statusFilter = searchParams?.status || ''
  const employeeFilter = searchParams?.employee || ''

  const employees = await prisma.user.findMany({
    where: { companyId, role: 'EMPLOYEE' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const requests = await prisma.travelRequest.findMany({
    where: {
      companyId,
      ...(statusFilter ? { status: statusFilter as never } : {}),
      ...(employeeFilter ? { employeeId: employeeFilter } : {}),
    },
    include: {
      employee: { select: { name: true, email: true } },
      event: { select: { eventName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'PENDING_MANAGER').length,
    confirmed: requests.filter((r) => r.status === 'BOOKING_CONFIRMED').length,
    totalCost: requests.reduce((s, r) => s + Number(r.estimatedCostUsd ?? 0), 0),
  }

  const statuses = [
    'PENDING_MANAGER', 'PENDING_AGENT', 'OPTIONS_PROVIDED',
    'APPROVED', 'BOOKING_CONFIRMED', 'REJECTED', 'CANCELLED',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Travel</h1>
        <p className="text-sm text-gray-500 mt-0.5">All travel requests from your team</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: stats.total, color: 'text-gray-900' },
          { label: 'Pending Review', value: stats.pending, color: 'text-yellow-600' },
          { label: 'Confirmed Bookings', value: stats.confirmed, color: 'text-green-600' },
          { label: 'Total Est. Cost', value: `$${stats.totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-blue-700' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={statusFilter}
          title="Filter by status"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          name="employee"
          defaultValue={employeeFilter}
          title="Filter by employee"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Filter
        </button>
        {(statusFilter || employeeFilter) && (
          <Link href="/manager/team-travel" className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-500 hover:bg-gray-50">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      {requests.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          No travel requests found.
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{r.employee.name}</p>
                    <p className="text-sm text-gray-600">{r.origin} → {r.destination}</p>
                    <p className="text-xs text-gray-400">{r.event.eventName}</p>
                  </div>
                  <Badge variant={statusToBadgeVariant(r.status)}>
                    {r.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                {r.estimatedCostUsd && (
                  <p className="text-sm font-semibold text-gray-900">${Number(r.estimatedCostUsd).toFixed(0)}</p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <Link href={`/manager/approvals/travel/${r.id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                  Review →
                </Link>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block rounded-xl border bg-white shadow-sm overflow-x-auto">
            <table className="w-full min-w-[700px] divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">Est. Cost</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.employee?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{r.employee?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.origin} → {r.destination}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[180px]">{r.event?.eventName ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(0)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusToBadgeVariant(r.status)}>
                        {r.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/manager/approvals/travel/${r.id}`} className="text-sm font-medium text-indigo-600 hover:underline whitespace-nowrap">
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
