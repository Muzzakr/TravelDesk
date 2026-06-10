import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

export default async function ManagerDashboard() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    pendingTravel,
    pendingExpenses,
    approvedThisMonth,
    teamCount,
    recentTravel,
    recentExpenses,
    monthlySpend,
  ] = await Promise.all([
    prisma.travelRequest.count({ where: { companyId, status: 'PENDING_MANAGER' } }),
    prisma.expense.count({ where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.travelRequest.count({
      where: { companyId, status: { in: ['APPROVED', 'BOOKING_CONFIRMED'] }, updatedAt: { gte: startOfMonth } },
    }),
    prisma.user.count({ where: { companyId, role: 'EMPLOYEE', isActive: true } }),
    prisma.travelRequest.findMany({
      where: { companyId },
      include: { employee: { select: { name: true } }, event: { select: { eventName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.expense.findMany({
      where: { companyId },
      include: { employee: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.expense.aggregate({
      where: { companyId, status: { in: ['APPROVED', 'PAID'] }, createdAt: { gte: startOfMonth } },
      _sum: { amountUsd: true },
    }),
  ])

  const totalSpend = Number(monthlySpend._sum.amountUsd ?? 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, Manager 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here&apos;s what&apos;s happening with your travel and expenses.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Link href="/manager/approvals" className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors">
          <p className="text-xs text-gray-500">Pending Travel Reviews</p>
          <p className="mt-1 text-3xl font-bold text-orange-600">{pendingTravel}</p>
          <p className="mt-1 text-xs text-indigo-600 font-medium">View all →</p>
        </Link>

        <Link href="/manager/approvals" className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors">
          <p className="text-xs text-gray-500">Pending Expense Reviews</p>
          <p className="mt-1 text-3xl font-bold text-yellow-600">{pendingExpenses}</p>
          <p className="mt-1 text-xs text-indigo-600 font-medium">View all →</p>
        </Link>

        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Approved This Month</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{approvedThisMonth}</p>
          <Link href="/manager/reports" className="mt-1 block text-xs text-indigo-600 font-medium">View report →</Link>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Total Spend This Month</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">${totalSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          <Link href="/manager/reports" className="mt-1 block text-xs text-indigo-600 font-medium">View report →</Link>
        </div>

        <Link href="/manager/users-roles" className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors">
          <p className="text-xs text-gray-500">Team Members</p>
          <p className="mt-1 text-3xl font-bold text-purple-600">{teamCount}</p>
          <p className="mt-1 text-xs text-indigo-600 font-medium">View team →</p>
        </Link>
      </div>

      {/* Recent sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Travel Requests */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold text-gray-800">Recent Travel Requests</h2>
            <Link href="/manager/team-travel" className="text-xs text-indigo-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentTravel.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">No travel requests yet.</p>
            ) : recentTravel.map((r) => (
              <Link key={r.id} href={`/manager/approvals/travel/${r.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.origin} → {r.destination}</p>
                  <p className="text-xs text-gray-500 truncate">{r.employee.name} · {r.event.eventName}</p>
                </div>
                <div className="ml-3 flex flex-col items-end gap-1">
                  <Badge variant={statusToBadgeVariant(r.status)}>
                    {r.status.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-[10px] text-gray-400">
                    {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold text-gray-800">Recent Expenses</h2>
            <Link href="/manager/team-expenses" className="text-xs text-indigo-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentExpenses.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">No expenses yet.</p>
            ) : recentExpenses.map((e) => (
              <Link key={e.id} href={`/manager/approvals/expense/${e.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.description}</p>
                  <p className="text-xs text-gray-500 truncate">{e.employee.name}</p>
                </div>
                <div className="ml-3 flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-gray-900">${Number(e.amountUsd).toFixed(0)}</span>
                  <Badge variant={statusToBadgeVariant(e.status)}>
                    {e.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow Overview */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm px-6 py-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Workflow Overview</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { icon: '👤', label: 'Employee', sub: 'Submit Request', color: 'border-blue-200 bg-blue-50' },
            { icon: '✅', label: 'Manager', sub: 'Review & Approve', color: 'border-yellow-200 bg-yellow-50' },
            { icon: '✈️', label: 'Agent', sub: 'Book Travel', color: 'border-purple-200 bg-purple-50' },
            { icon: '💰', label: 'Finance', sub: 'Process Payment', color: 'border-green-200 bg-green-50' },
            { icon: '🎯', label: 'Completed', sub: 'Trip / Expense Done', color: 'border-gray-200 bg-gray-50' },
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-2 flex-shrink-0">
              <div className={`flex flex-col items-center rounded-xl border px-4 py-3 min-w-[100px] ${step.color}`}>
                <span className="text-xl mb-1">{step.icon}</span>
                <span className="text-xs font-semibold text-gray-800">{step.label}</span>
                <span className="text-[10px] text-gray-500 text-center mt-0.5">{step.sub}</span>
              </div>
              {i < arr.length - 1 && (
                <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
