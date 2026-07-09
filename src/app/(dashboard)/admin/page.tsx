export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plane, Calendar, CreditCard, BarChart3, Users, Search } from 'lucide-react'

const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

export default async function AdminDashboard() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const now = new Date()

  const [
    userCount,
    activeUserCount,
    eventCount,
    activeEventCount,
    upcomingEventCount,
    travelRequestTotal,
    travelRequestPending,
    travelRequestRejected,
    recentRequests,
    expenseTotal,
    expensePendingPayout,
    expenseMissingReceipts,
    recentExpenses,
    payoutReportCount,
    latestPayoutReport,
    recentAudit,
    approvedSpend,
  ] = await Promise.all([
    prisma.user.count({ where: { companyId } }),
    prisma.user.count({ where: { companyId, isActive: true } }),
    prisma.event.count({ where: { companyId } }),
    prisma.event.count({ where: { companyId, status: 'ACTIVE' } }),
    prisma.event.count({ where: { companyId, eventDate: { gte: now } } }),
    prisma.travelRequest.count({ where: { companyId } }),
    prisma.travelRequest.count({
      where: { companyId, status: { in: ['PENDING_AGENT', 'PENDING_MANAGER', 'OPTIONS_PROVIDED'] } },
    }),
    prisma.travelRequest.count({ where: { companyId, status: 'REJECTED' } }),
    prisma.travelRequest.findMany({
      where: { companyId },
      select: {
        id: true, status: true, createdAt: true, origin: true, destination: true,
        employee: { select: { name: true } },
        event: { select: { eventName: true, eventCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.expense.count({ where: { companyId } }),
    prisma.expense.count({ where: { companyId, status: 'APPROVED', payoutReportId: null } }),
    prisma.expense.count({
      where: {
        companyId, status: 'APPROVED', payoutReportId: null,
        receipts: { none: {} },
      },
    }),
    prisma.expense.findMany({
      where: { companyId },
      select: {
        id: true, amountUsd: true, category: true, description: true, merchantName: true, status: true, createdAt: true,
        employee: { select: { name: true } },
        event: { select: { eventName: true, eventCode: true } },
        receipts: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.payoutReport.count({ where: { companyId } }),
    prisma.payoutReport.findFirst({
      where: { companyId },
      orderBy: { generatedAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { actor: { select: { name: true } } },
    }),
    prisma.expense.aggregate({
      where: { companyId, status: { in: ['APPROVED', 'PAID'] } },
      _sum: { amountUsd: true },
    }),
  ])

  const totalApproved = Number(approvedSpend._sum.amountUsd ?? 0)
  const pendingPayoutTotal = await prisma.expense.aggregate({
    where: { companyId, status: 'APPROVED', payoutReportId: null },
    _sum: { amountUsd: true },
  })
  const totalPendingPayout = Number(pendingPayoutTotal._sum.amountUsd ?? 0)

  const urgentItems = [
    travelRequestPending > 0 && { count: travelRequestPending, label: 'Open requests', href: '/admin/travel-requests', color: 'amber' as const },
    expenseMissingReceipts > 0 && { count: expenseMissingReceipts, label: 'Missing receipts', href: '/admin/expenses', color: 'red' as const },
    expensePendingPayout > 0 && { count: expensePendingPayout, label: 'Pending payout', href: '/finance/payout-reports', color: 'orange' as const },
  ].filter(Boolean) as { count: number; label: string; href: string; color: 'amber' | 'red' | 'orange' }[]

  const urgentColors = {
    amber:  { border: 'border-amber-300',  bg: 'bg-amber-50',  text: 'text-amber-600',  sub: 'text-amber-700' },
    red:    { border: 'border-red-300',    bg: 'bg-red-50',    text: 'text-red-600',    sub: 'text-red-700' },
    orange: { border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-600', sub: 'text-orange-700' },
  }

  const kpis = [
    { label: 'Total Users',    value: userCount,          sub: `${activeUserCount} active`,   href: '/admin/users',              urgent: false },
    { label: 'Events',         value: eventCount,         sub: `${activeEventCount} active`,  href: '/admin/events',             urgent: false },
    { label: 'Open Requests',  value: travelRequestPending, sub: 'need action',              href: '/admin/travel-requests', urgent: travelRequestPending > 0 },
    { label: 'Approved Spend', value: `$${totalApproved.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: 'total approved', href: '/finance', urgent: false },
    { label: 'Pending Payout', value: `$${totalPendingPayout.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: `${expensePendingPayout} expenses`, href: '/finance/payout-reports', urgent: totalPendingPayout > 0 },
  ]

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {urgentItems.length > 0
              ? `${urgentItems.length} item${urgentItems.length > 1 ? 's' : ''} require${urgentItems.length === 1 ? 's' : ''} attention`
              : 'All systems healthy'}
          </p>
        </div>
        <span className="text-xs text-gray-400 mt-1.5">
          {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* ── Needs Attention ─────────────────────────────────── */}
      {urgentItems.length > 0 && (
        <section>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Needs attention</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {urgentItems.map((item) => {
              const c = urgentColors[item.color]
              return (
                <Link key={item.label} href={item.href}
                  className={`rounded-xl border-2 ${c.border} ${c.bg} px-5 py-4 flex items-center justify-between hover:shadow-md transition-all group`}>
                  <div>
                    <p className={`text-3xl font-bold ${c.text}`}>{item.count}</p>
                    <p className={`text-sm font-medium ${c.sub} mt-0.5`}>{item.label}</p>
                  </div>
                  <span className={`${c.text} opacity-50 group-hover:opacity-100 transition-opacity`}><ChevronRight /></span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── KPI Cards — Mobile list ─────────────────────────── */}
      <div className="sm:hidden rounded-2xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-50">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}
            className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${k.urgent ? 'bg-amber-50' : ''}`}>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${k.urgent ? 'text-amber-700' : 'text-gray-800'}`}>{k.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
            </div>
            <p className={`text-xl font-bold ml-4 shrink-0 ${k.urgent ? 'text-amber-600' : 'text-gray-900'}`}>{k.value}</p>
          </Link>
        ))}
      </div>

      {/* ── KPI Cards — Desktop grid ─────────────────────────── */}
      <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}
            className={`rounded-xl border bg-white px-4 py-3 hover:shadow-md transition-all group ${k.urgent ? 'border-amber-300 bg-amber-50' : 'border-gray-100'}`}>
            <p className={`text-2xl font-bold truncate ${k.urgent ? 'text-amber-600' : 'text-gray-900'}`}>{k.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{k.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
          </Link>
        ))}
      </div>

      {/* ── Module Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Travel Requests */}
        <details className="group rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600"><Plane className="w-4 h-4" /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Travel Requests</p>
                <p className="text-xs text-gray-400">{travelRequestTotal} total · {travelRequestPending} pending</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {travelRequestPending > 0 && (
                <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5">{travelRequestPending}</span>
              )}
              <svg className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </summary>

          {/* Summary stats */}
          <div className="px-5 pb-3 grid grid-cols-3 gap-2 sm:gap-3 border-t border-gray-50 pt-3">
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-gray-900">{travelRequestTotal}</p>
              <p className="text-[11px] text-gray-400">Total</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-amber-600">{travelRequestPending}</p>
              <p className="text-[11px] text-gray-400">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-red-500">{travelRequestRejected}</p>
              <p className="text-[11px] text-gray-400">Rejected</p>
            </div>
          </div>

          {/* Preview rows */}
          {recentRequests.length > 0 && (
            <div className="border-t border-gray-50 divide-y divide-gray-50">
              {recentRequests.map((r) => (
                <Link key={r.id} href={`/admin/travel-requests/${r.id}`}
                  className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{r.employee.name}</p>
                    <p className="text-xs text-gray-400 truncate">{r.origin} → {r.destination}</p>
                  </div>
                  <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
            <Link href="/admin/travel-requests" className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:underline px-1 py-2 -mx-1 min-h-[44px]">View all →</Link>
            <Link href="/employee/travel-requests/new" className="inline-flex items-center text-xs text-gray-500 hover:underline px-1 py-2 min-h-[44px]">New request</Link>
          </div>
        </details>

        {/* Events */}
        <details className="group rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><Calendar className="w-4 h-4" /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Events</p>
                <p className="text-xs text-gray-400">{eventCount} total · {activeEventCount} active</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </summary>

          <div className="px-5 pb-3 grid grid-cols-3 gap-2 sm:gap-3 border-t border-gray-50 pt-3">
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-gray-900">{eventCount}</p>
              <p className="text-[11px] text-gray-400">Total</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-green-600">{activeEventCount}</p>
              <p className="text-[11px] text-gray-400">Active</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-indigo-600">{upcomingEventCount}</p>
              <p className="text-[11px] text-gray-400">Upcoming</p>
            </div>
          </div>

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
            <Link href="/admin/events" className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:underline px-1 py-2 -mx-1 min-h-[44px]">View all →</Link>
            <Link href="/finance/events" className="inline-flex items-center text-xs text-gray-500 hover:underline px-1 py-2 min-h-[44px]">Manage budgets</Link>
          </div>
        </details>

        {/* Expenses */}
        <details className="group rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><CreditCard className="w-4 h-4" /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Expenses</p>
                <p className="text-xs text-gray-400">{expenseTotal} total · ${totalPendingPayout.toLocaleString('en-US', { maximumFractionDigits: 0 })} pending</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {expenseMissingReceipts > 0 && (
                <span className="rounded-full bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5">{expenseMissingReceipts} missing</span>
              )}
              <svg className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </summary>

          <div className="px-5 pb-3 grid grid-cols-3 gap-2 sm:gap-3 border-t border-gray-50 pt-3">
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-gray-900">{expenseTotal}</p>
              <p className="text-[11px] text-gray-400">Total</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-orange-600">{expensePendingPayout}</p>
              <p className="text-[11px] text-gray-400">Pending payout</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-red-500">{expenseMissingReceipts}</p>
              <p className="text-[11px] text-gray-400">Missing receipts</p>
            </div>
          </div>

          {recentExpenses.length > 0 && (
            <div className="border-t border-gray-50 divide-y divide-gray-50">
              {recentExpenses.map((e) => (
                <Link key={e.id} href={`/manager/approvals/expense/${e.id}`}
                  className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{e.employee.name}</p>
                    <p className="text-xs text-gray-400 truncate">{(e.category ?? '').replace(/_/g, ' ')} · {e.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-gray-700">${Number(e.amountUsd).toFixed(0)}</span>
                    <Badge variant={statusToBadgeVariant(e.status)}>{e.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
            <Link href="/admin/expenses" className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:underline px-1 py-2 -mx-1 min-h-[44px]">View all →</Link>
            <Link href="/finance/payout-reports" className="inline-flex items-center text-xs text-gray-500 hover:underline px-1 py-2 min-h-[44px]">Generate payout</Link>
          </div>
        </details>

        {/* Payout Reports */}
        <details className="group rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600"><BarChart3 className="w-4 h-4" /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Payout Reports</p>
                <p className="text-xs text-gray-400">{payoutReportCount} total reports</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </summary>

          <div className="px-5 pb-3 grid grid-cols-2 gap-2 sm:gap-3 border-t border-gray-50 pt-3">
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-gray-900">{payoutReportCount}</p>
              <p className="text-[11px] text-gray-400">Total reports</p>
            </div>
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-green-600">${totalApproved.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className="text-[11px] text-gray-400">Total paid out</p>
            </div>
          </div>

          {latestPayoutReport && (
            <div className="border-t border-gray-50 px-5 py-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Latest report</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">${Number(latestPayoutReport.totalUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(latestPayoutReport.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                    {new Date(latestPayoutReport.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <Badge variant={statusToBadgeVariant(latestPayoutReport.status)}>{latestPayoutReport.status.replace(/_/g, ' ')}</Badge>
              </div>
            </div>
          )}

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
            <Link href="/finance/payout-reports" className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:underline px-1 py-2 -mx-1 min-h-[44px]">View all →</Link>
            <Link href="/finance/spend-analytics" className="text-xs text-gray-500 hover:underline">Spend analytics</Link>
          </div>
        </details>
      </div>

      {/* ── Bottom Row: Users + Audit ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Users */}
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600"><Users className="w-4 h-4" /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Team</p>
                <p className="text-xs text-gray-400">{userCount} users · {activeUserCount} active</p>
              </div>
            </div>
            <Link href="/admin/users" className="text-xs font-semibold text-indigo-600 hover:underline">Manage →</Link>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-2xl font-bold text-gray-900">{userCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total users</p>
            </div>
            <div className="rounded-xl bg-green-50 px-4 py-3">
              <p className="text-2xl font-bold text-green-700">{activeUserCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Active</p>
            </div>
          </div>
          <div className="px-5 pb-4 flex gap-3">
            <Link href="/admin/users" className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 text-center transition-colors">
              View all users
            </Link>
          </div>
        </div>

        {/* Audit Log */}
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500"><Search className="w-4 h-4" /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Audit Log</p>
                <p className="text-xs text-gray-400">Recent activity</p>
              </div>
            </div>
            <Link href="/admin/audit-log" className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:underline px-1 py-2 -mx-1 min-h-[44px]">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentAudit.length === 0 ? (
              <p className="px-5 py-4 text-xs text-gray-400">No activity yet.</p>
            ) : recentAudit.map((log) => (
              <div key={log.id} className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-medium text-gray-700 truncate">{log.action}</p>
                  <p className="text-xs text-gray-400">{log.actor?.name ?? 'System'} · {log.entityType}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
