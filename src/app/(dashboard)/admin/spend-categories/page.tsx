export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/Badge'
import { redirect } from 'next/navigation'

const roleBadge: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
  EMPLOYEE: 'blue',
  MANAGER: 'green',
  TRAVEL_AGENT: 'purple',
  FINANCE_ADMIN: 'yellow',
  SYSTEM_ADMIN: 'gray',
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  TRANSPORT:     { label: 'Travel & Transport',    icon: '✈️',  color: 'bg-blue-500' },
  ACCOMMODATION: { label: 'Accommodation',          icon: '🏨',  color: 'bg-purple-500' },
  MEALS:         { label: 'Meals & Daily Expenses', icon: '🍽️', color: 'bg-orange-500' },
  SUPPLIES:      { label: 'Supplies',               icon: '📦',  color: 'bg-teal-500' },
  OTHER:         { label: 'Other',                  icon: '📋',  color: 'bg-gray-400' },
}

export default async function SpendCategoriesPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const [expensesByCategory, totalApproved, totalPending, topSpenders] = await Promise.all([
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
  ])

  const approvedTotal = Number(totalApproved._sum.amountUsd ?? 0)
  const pendingTotal = Number(totalPending._sum.amountUsd ?? 0)
  const maxCategory = Math.max(...expensesByCategory.map((c) => Number(c._sum.amountUsd ?? 0)), 1)

  const spenderIds = topSpenders.map((s) => s.employeeId)
  const spenderUsers = spenderIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: spenderIds } }, select: { id: true, name: true, role: true } })
    : []
  const spenderMap = Object.fromEntries(spenderUsers.map((u) => [u.id, { name: u.name, role: u.role }]))

  const grandTotal = approvedTotal + pendingTotal

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Spent categories</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total spend</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">${grandTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Approved & paid</p>
          <p className="mt-1 text-3xl font-bold text-green-600">${approvedTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending approval</p>
          <p className="mt-1 text-3xl font-bold text-yellow-500">${pendingTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Spend by category — full width, richer detail */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Spend by category</h2>
        {expensesByCategory.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No approved expenses yet.</div>
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
                  const sharePct = approvedTotal > 0 ? Math.round((amount / approvedTotal) * 100) : 0
                  const meta = CATEGORY_META[cat.category] ?? { label: cat.category, icon: '📋', color: 'bg-gray-400' }
                  return (
                    <tr key={cat.category} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-medium text-gray-900">
                        <span className="mr-2">{meta.icon}</span>{meta.label}
                      </td>
                      <td className="px-5 py-4 text-right text-gray-500">{cat._count.id}</td>
                      <td className="px-5 py-4 text-right font-semibold text-gray-900">
                        ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-gray-100">
                            <div className={`h-2 rounded-full ${meta.color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-8 text-right">{sharePct}%</span>
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

      {/* Top spenders — expanded to top 10 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Top spenders</h2>
        {topSpenders.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No approved expenses yet.</div>
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
                  const sharePct = approvedTotal > 0 ? Math.round((amount / approvedTotal) * 100) : 0
                  return (
                    <tr key={s.employeeId} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-xs text-gray-400">{i + 1}.</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{info?.name ?? 'Unknown'}</td>
                      <td className="px-5 py-3">
                        {info?.role && (
                          <Badge variant={roleBadge[info.role] ?? 'gray'}>{info.role.replace(/_/g, ' ')}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-800">
                        ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${sharePct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-8 text-right">{sharePct}%</span>
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
    </div>
  )
}
