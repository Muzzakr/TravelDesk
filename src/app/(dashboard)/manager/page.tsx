export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plane, CreditCard } from 'lucide-react'

const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

export default async function ManagerDashboard() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  let travelPending = 0, travelTotal = 0, travelRejected = 0, travelApprovedMonth = 0
  let expensePending = 0, expenseTotal = 0, expenseApprovedMonth = 0, teamCount = 0, activeTeamCount = 0
  let totalSpendAmount = 0
  type TravelRow = { id: string; status: string; createdAt: Date; origin: string; destination: string; employee: { name: string }; event: { eventName: string; eventCode: string } }
  type ExpenseRow = { id: string; amountUsd: unknown; category: string | null; description: string; status: string; createdAt: Date; employee: { name: string }; event: { eventName: string; eventCode: string } }
  let recentTravel: TravelRow[] = []
  let recentExpenses: ExpenseRow[] = []
  let fetchError: string | null = null

  try {
    travelPending = await prisma.travelRequest.count({ where: { companyId, status: 'PENDING_MANAGER' } })
    travelTotal = await prisma.travelRequest.count({ where: { companyId } })
    travelRejected = await prisma.travelRequest.count({ where: { companyId, status: 'REJECTED' } })
    travelApprovedMonth = await prisma.travelRequest.count({ where: { companyId, status: { in: ['APPROVED', 'BOOKING_CONFIRMED'] }, updatedAt: { gte: startOfMonth } } })
    recentTravel = await prisma.travelRequest.findMany({
      where: { companyId },
      select: { id: true, status: true, createdAt: true, origin: true, destination: true, employee: { select: { name: true } }, event: { select: { eventName: true, eventCode: true } } },
      orderBy: { createdAt: 'desc' }, take: 5,
    })
    expensePending = await prisma.expense.count({ where: { companyId, status: 'SUBMITTED' } })
    expenseTotal = await prisma.expense.count({ where: { companyId } })
    expenseApprovedMonth = await prisma.expense.count({ where: { companyId, status: 'APPROVED', updatedAt: { gte: startOfMonth } } })
    recentExpenses = await prisma.expense.findMany({
      where: { companyId },
      select: { id: true, amountUsd: true, category: true, description: true, status: true, createdAt: true, employee: { select: { name: true } }, event: { select: { eventName: true, eventCode: true } } },
      orderBy: { createdAt: 'desc' }, take: 5,
    })
    teamCount = await prisma.user.count({ where: { companyId, role: 'EMPLOYEE' } })
    activeTeamCount = await prisma.user.count({ where: { companyId, role: 'EMPLOYEE', isActive: true } })
    const spendAgg = await prisma.expense.aggregate({ where: { companyId, status: 'APPROVED', createdAt: { gte: startOfMonth } }, _sum: { amountUsd: true } })
    totalSpendAmount = Number(spendAgg._sum.amountUsd ?? 0)
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err)
  }

  if (fetchError) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 max-w-2xl">
        <p className="text-sm font-semibold text-red-700 mb-2">Dashboard data error</p>
        <pre className="text-xs text-red-600 whitespace-pre-wrap break-all">{fetchError}</pre>
      </div>
    )
  }

  const urgentItems = [
    travelPending > 0 && { count: travelPending, label: 'Travel requests pending', href: '/manager/team-travel', color: 'amber' as const },
    expensePending > 0 && { count: expensePending, label: 'Expenses pending', href: '/manager/team-expenses', color: 'orange' as const },
  ].filter(Boolean) as { count: number; label: string; href: string; color: 'amber' | 'orange' }[]

  const urgentColors = {
    amber:  { border: 'border-amber-300',  bg: 'bg-amber-50',  text: 'text-amber-600',  sub: 'text-amber-700' },
    orange: { border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-600', sub: 'text-orange-700' },
  }

  const kpis = [
    { label: 'Team Members',     value: teamCount,       sub: `${activeTeamCount} active`,    href: '/manager/users-roles',   urgent: false },
    { label: 'Open Requests',    value: travelPending,   sub: 'need review',                  href: '/manager/approvals',     urgent: travelPending > 0 },
    { label: 'Pending Expenses', value: expensePending,  sub: 'need review',                  href: '/manager/team-expenses', urgent: expensePending > 0 },
    { label: 'Approved This Month', value: travelApprovedMonth, sub: 'travel requests',       href: '/manager/team-travel',   urgent: false },
    { label: 'Spend This Month', value: `$${totalSpendAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: 'approved expenses', href: '/manager/reports', urgent: false },
  ]

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{session.user.role === 'TRAVEL_MANAGER' ? 'Travel Manager Dashboard' : 'Manager Dashboard'}</h1>
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

      {/* Needs Attention */}
      {urgentItems.length > 0 && (
        <section>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Needs attention</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}
            className={`rounded-xl border bg-white px-5 py-4 hover:shadow-md transition-all group ${k.urgent ? 'border-amber-300 bg-amber-50' : 'border-gray-100'}`}>
            <p className={`text-2xl font-bold ${k.urgent ? 'text-amber-600' : 'text-gray-900'}`}>{k.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{k.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
          </Link>
        ))}
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Travel Requests */}
        <details className="group rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600"><Plane className="w-4 h-4" /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Travel Requests</p>
                <p className="text-xs text-gray-400">{travelTotal} total · {travelPending} pending review</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {travelPending > 0 && (
                <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5">{travelPending}</span>
              )}
              <svg className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </summary>

          <div className="px-5 pb-3 grid grid-cols-3 gap-3 border-t border-gray-50 pt-3">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{travelTotal}</p>
              <p className="text-[11px] text-gray-400">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-600">{travelPending}</p>
              <p className="text-[11px] text-gray-400">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-500">{travelRejected}</p>
              <p className="text-[11px] text-gray-400">Rejected</p>
            </div>
          </div>

          {recentTravel.length > 0 && (
            <div className="border-t border-gray-50 divide-y divide-gray-50">
              {recentTravel.map((r) => (
                <Link key={r.id} href={`/manager/approvals/travel/${r.id}`}
                  className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{r.employee.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{r.origin} → {r.destination}</p>
                  </div>
                  <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                </Link>
              ))}
            </div>
          )}

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
            <Link href="/manager/team-travel" className="text-xs font-semibold text-indigo-600 hover:underline">View all →</Link>
            <Link href="/manager/approvals" className="text-xs text-gray-500 hover:underline">Pending approvals</Link>
          </div>
        </details>

        {/* Team Expenses */}
        <details className="group rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><CreditCard className="w-4 h-4" /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Team Expenses</p>
                <p className="text-xs text-gray-400">{expenseTotal} total · {expensePending} pending review</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {expensePending > 0 && (
                <span className="rounded-full bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5">{expensePending}</span>
              )}
              <svg className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </summary>

          <div className="px-5 pb-3 grid grid-cols-3 gap-3 border-t border-gray-50 pt-3">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{expenseTotal}</p>
              <p className="text-[11px] text-gray-400">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-orange-600">{expensePending}</p>
              <p className="text-[11px] text-gray-400">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{expenseApprovedMonth}</p>
              <p className="text-[11px] text-gray-400">Approved (month)</p>
            </div>
          </div>

          {recentExpenses.length > 0 && (
            <div className="border-t border-gray-50 divide-y divide-gray-50">
              {recentExpenses.map((e) => (
                <Link key={e.id} href={`/manager/approvals/expense/${e.id}`}
                  className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{e.employee.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{(e.category ?? '').replace(/_/g, ' ')} · {e.description}</p>
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
            <Link href="/manager/team-expenses" className="text-xs font-semibold text-indigo-600 hover:underline">View all →</Link>
            <Link href="/manager/approvals" className="text-xs text-gray-500 hover:underline">Pending approvals</Link>
          </div>
        </details>
      </div>

    </div>
  )
}