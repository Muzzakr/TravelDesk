export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PaperAirplaneIcon, BuildingOfficeIcon, ShoppingBagIcon, ArchiveBoxIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'
type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>

const roleBadge: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
  EMPLOYEE: 'blue',
  MANAGER: 'green',
  TRAVEL_AGENT: 'purple',
  FINANCE_ADMIN: 'yellow',
  SYSTEM_ADMIN: 'gray',
}

const CATEGORY_META: Record<string, { label: string; Icon: HeroIcon; color: string }> = {
  TRANSPORT:     { label: 'Travel & Transport',    Icon: PaperAirplaneIcon,  color: 'bg-blue-500' },
  ACCOMMODATION: { label: 'Accommodation',          Icon: BuildingOfficeIcon, color: 'bg-purple-500' },
  MEALS:         { label: 'Meals & Daily Expenses', Icon: ShoppingBagIcon,    color: 'bg-orange-500' },
  SUPPLIES:      { label: 'Supplies',               Icon: ArchiveBoxIcon,     color: 'bg-teal-500' },
  OTHER:         { label: 'Other',                  Icon: PlusCircleIcon,     color: 'bg-gray-400' },
}

const TR_STATUS_LABELS: Record<string, string> = {
  SUBMITTED:        'Submitted',
  PENDING_MANAGER:  'Pending manager',
  PENDING_AGENT:    'With agent',
  BOOKING_CONFIRMED:'Confirmed',
  REJECTED:         'Rejected',
  CANCELLED:        'Cancelled',
}

export default async function SpendCategoriesPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId
  const activeTab = searchParams?.tab === 'travel' ? 'travel' : 'expenses'

  const [expensesByCategory, totalApproved, totalPending, topSpenders, travelRequests] =
    await Promise.all([
      prisma.expense.groupBy({
        by: ['category'],
        where: { companyId, status: { in: ['APPROVED', 'PAID'] } },
        _sum: { amountUsd: true },
        _count: { id: true },
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
        take: 10,
      }),
      prisma.travelRequest.findMany({
        where: { companyId },
        select: {
          id: true,
          origin: true,
          destination: true,
          status: true,
          estimatedCostUsd: true,
          createdAt: true,
          employee: { select: { id: true, name: true, role: true } },
          event: { select: { eventName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ])

  const approvedTotal = Number(totalApproved._sum.amountUsd ?? 0)
  const pendingTotal = Number(totalPending._sum.amountUsd ?? 0)
  const maxCategory = Math.max(
    ...expensesByCategory.map((c) => Number(c._sum.amountUsd ?? 0)),
    1
  )

  const spenderIds = topSpenders.map((s) => s.employeeId)
  const spenderUsers =
    spenderIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: spenderIds } },
          select: { id: true, name: true, role: true },
        })
      : []
  const spenderMap = Object.fromEntries(
    spenderUsers.map((u) => [u.id, { name: u.name, role: u.role }])
  )
  const grandTotal = approvedTotal + pendingTotal

  // Travel request aggregates
  const trTotal = travelRequests.length
  const trPending = travelRequests.filter((t) =>
    ['SUBMITTED', 'PENDING_MANAGER', 'PENDING_AGENT'].includes(t.status)
  ).length
  const trConfirmed = travelRequests.filter((t) => t.status === 'BOOKING_CONFIRMED').length
  const trEstimatedCost = travelRequests.reduce(
    (s, t) => s + Number(t.estimatedCostUsd ?? 0),
    0
  )

  // Travel requests by status breakdown
  const trByStatus = Object.entries(TR_STATUS_LABELS).map(([status, label]) => ({
    status,
    label,
    count: travelRequests.filter((t) => t.status === status).length,
  })).filter((s) => s.count > 0)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Spend overview</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <Link
          href="?tab=expenses"
          className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
            activeTab === 'expenses'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Expenses
        </Link>
        <Link
          href="?tab=travel"
          className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
            activeTab === 'travel'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Travel requests
        </Link>
      </div>

      {activeTab === 'expenses' ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Total spend</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                ${grandTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Approved & paid</p>
              <p className="mt-1 text-3xl font-bold text-green-600">
                ${approvedTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Pending approval</p>
              <p className="mt-1 text-3xl font-bold text-yellow-500">
                ${pendingTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Spend by category */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Spend by category</h2>
            {expensesByCategory.length === 0 ? (
              <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">
                No approved expenses yet.
              </div>
            ) : (
              <div className="rounded-xl border bg-white overflow-hidden">
                <table className="w-full text-sm divide-y divide-gray-100">
                  <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left">Category</th>
                      <th className="px-5 py-3 text-right">Expenses</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3 text-left w-56">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {expensesByCategory.map((cat) => {
                      const amount = Number(cat._sum.amountUsd ?? 0)
                      const pct = Math.round((amount / maxCategory) * 100)
                      const sharePct =
                        approvedTotal > 0 ? Math.round((amount / approvedTotal) * 100) : 0
                      const meta =
                        CATEGORY_META[cat.category] ?? {
                          label: cat.category,
                          Icon: PlusCircleIcon,
                          color: 'bg-gray-400',
                        }
                      return (
                        <tr key={cat.category} className="hover:bg-gray-50">
                          <td className="px-5 py-4 font-medium text-gray-900">
                            <meta.Icon className="w-4 h-4 inline shrink-0 mr-1.5" />
                            {meta.label}
                          </td>
                          <td className="px-5 py-4 text-right text-gray-500">{cat._count.id}</td>
                          <td className="px-5 py-4 text-right font-semibold text-gray-900">
                            ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-gray-100">
                                {/* eslint-disable-next-line react/forbid-component-props */}
                                <div
                                  className={`h-2 rounded-full ${meta.color}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-8 text-right">
                                {sharePct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                    <tr>
                      <td className="px-5 py-3 text-sm font-semibold text-gray-700">Total</td>
                      <td className="px-5 py-3 text-right text-sm text-gray-500">
                        {expensesByCategory.reduce((s, c) => s + c._count.id, 0)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                        ${approvedTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Top spenders */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Top spenders</h2>
            {topSpenders.length === 0 ? (
              <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">
                No approved expenses yet.
              </div>
            ) : (
              <div className="rounded-xl border bg-white overflow-hidden">
                <table className="w-full text-sm divide-y divide-gray-100">
                  <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left w-8">#</th>
                      <th className="px-5 py-3 text-left">Employee</th>
                      <th className="px-5 py-3 text-left">Role</th>
                      <th className="px-5 py-3 text-right">Approved spend</th>
                      <th className="px-5 py-3 text-left w-48">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {topSpenders.map((s, i) => {
                      const info = spenderMap[s.employeeId]
                      const amount = Number(s._sum.amountUsd ?? 0)
                      const sharePct =
                        approvedTotal > 0 ? Math.round((amount / approvedTotal) * 100) : 0
                      return (
                        <tr key={s.employeeId} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-xs text-gray-400">{i + 1}.</td>
                          <td className="px-5 py-3 font-medium text-gray-900">
                            {info?.name ?? 'Unknown'}
                          </td>
                          <td className="px-5 py-3">
                            {info?.role && (
                              <Badge variant={roleBadge[info.role] ?? 'gray'}>
                                {info.role.replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-800">
                            ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-gray-100">
                                {/* eslint-disable-next-line react/forbid-component-props */}
                                <div
                                  className="h-2 rounded-full bg-indigo-500"
                                  style={{ width: `${sharePct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-8 text-right">
                                {sharePct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {/* Travel request KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Total requests</p>
              <p className="mt-1 text-3xl font-bold text-indigo-600">{trTotal}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">In progress</p>
              <p className="mt-1 text-3xl font-bold text-yellow-600">{trPending}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Confirmed</p>
              <p className="mt-1 text-3xl font-bold text-green-600">{trConfirmed}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Est. total cost</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                ${trEstimatedCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Status breakdown */}
          {trByStatus.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-800">By status</h2>
              <div className="rounded-xl border bg-white overflow-hidden">
                <table className="w-full text-sm divide-y divide-gray-100">
                  <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-right">Requests</th>
                      <th className="px-5 py-3 text-left w-56">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {trByStatus.map(({ status, label, count }) => {
                      const pct = trTotal > 0 ? Math.round((count / trTotal) * 100) : 0
                      return (
                        <tr key={status} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-900">
                            <Badge variant={statusToBadgeVariant(status)}>{label}</Badge>
                          </td>
                          <td className="px-5 py-3 text-right text-gray-700 font-semibold">
                            {count}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-gray-100">
                                {/* eslint-disable-next-line react/forbid-component-props */}
                                <div
                                  className="h-2 rounded-full bg-indigo-400"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
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

          {/* Recent travel requests */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Recent requests</h2>
            {travelRequests.length === 0 ? (
              <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">
                No travel requests yet.
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="sm:hidden space-y-2">
                  {travelRequests.map((tr) => (
                    <div key={tr.id} className="rounded-xl border bg-white px-4 py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-gray-900 text-sm">
                          {tr.origin} → {tr.destination}
                        </p>
                        {tr.estimatedCostUsd && (
                          <p className="font-semibold text-gray-900 shrink-0">
                            ${Number(tr.estimatedCostUsd).toFixed(0)}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{tr.employee.name} · {tr.event.eventName}</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-gray-300">
                          {new Date(tr.createdAt).toLocaleDateString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                        <Badge variant={statusToBadgeVariant(tr.status)}>
                          {tr.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
                  <table className="min-w-[700px] w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Employee</th>
                        <th className="px-4 py-3 text-left">Route</th>
                        <th className="px-4 py-3 text-left">Event</th>
                        <th className="px-4 py-3 text-left">Est. cost</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {travelRequests.map((tr) => (
                        <tr key={tr.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{tr.employee.name}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {tr.origin} → {tr.destination}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{tr.event.eventName}</td>
                          <td className="px-4 py-3">
                            {tr.estimatedCostUsd
                              ? `$${Number(tr.estimatedCostUsd).toFixed(0)}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusToBadgeVariant(tr.status)}>
                              {tr.status.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {new Date(tr.createdAt).toLocaleDateString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
