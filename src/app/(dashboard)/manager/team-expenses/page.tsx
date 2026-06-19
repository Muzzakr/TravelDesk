export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { ExpenseApproveActions } from '@/components/manager/ExpenseApproveActions'

export default async function TeamExpensesPage({
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

  const expenses = await prisma.expense.findMany({
    where: {
      companyId,
      ...(statusFilter ? { status: statusFilter as never } : {}),
      ...(employeeFilter ? { employeeId: employeeFilter } : {}),
    },
    include: {
      employee: { select: { name: true, email: true } },
      event: { select: { eventName: true, eventCode: true } },
      receipts: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const stats = {
    total: expenses.length,
    pending: expenses.filter((e) => ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)).length,
    approved: expenses.filter((e) => e.status === 'APPROVED').length,
    totalAmount: expenses.reduce((s, e) => s + Number(e.amountUsd), 0),
  }

  const statuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Expenses</h1>
        <p className="text-sm text-gray-500 mt-0.5">All expenses submitted by your team</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Expenses', value: stats.total, color: 'text-gray-900' },
          { label: 'Pending Approval', value: stats.pending, color: 'text-yellow-600' },
          { label: 'Approved', value: stats.approved, color: 'text-green-600' },
          { label: 'Total Amount', value: `$${stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'text-blue-700' },
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
          <Link href="/manager/team-expenses" className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-500 hover:bg-gray-50">
            Clear
          </Link>
        )}
      </form>

      {/* List */}
      {expenses.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          No expenses found.
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {expenses.map((e) => {
              const isPending = ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)
              return (
                <div key={e.id} className="rounded-xl border bg-white overflow-hidden">
                  {/* Clickable info area */}
                  <Link
                    href={`/manager/approvals/expense/${e.id}`}
                    className="block px-4 pt-3 pb-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{e.employee.name}</p>
                        <p className="text-sm text-gray-600 truncate">{e.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{e.event.eventName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <p className="font-bold text-gray-900">${Number(e.amountUsd).toFixed(2)}</p>
                        <Badge variant={statusToBadgeVariant(e.status)}>
                          {e.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </Link>
                  {/* Action row (separate from the link) */}
                  <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-end gap-2">
                    {isPending ? (
                      <ExpenseApproveActions expenseId={e.id} />
                    ) : (
                      <Link
                        href={`/manager/approvals/expense/${e.id}`}
                        className="text-sm font-medium text-indigo-600 hover:underline"
                      >
                        View details →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl border bg-white shadow-sm overflow-x-auto">
            <table className="w-full min-w-[700px] divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Event / Category</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.map((e) => {
                  const isPending = ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)
                  const detailHref = `/manager/approvals/expense/${e.id}`
                  return (
                    /* relative on tr so the overlay link covers the full row */
                    <tr key={e.id} className="relative hover:bg-gray-50 cursor-pointer">
                      {/* Invisible overlay link — covers the row; buttons sit above it via z-20 */}
                      <td className="px-4 py-3">
                        <Link
                          href={detailHref}
                          className="absolute inset-0 z-10"
                          aria-label={`Review ${e.employee.name}'s expense`}
                        />
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                            {e.employee.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{e.employee.name}</p>
                            <p className="text-xs text-gray-400 truncate">{e.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 truncate max-w-[160px]">{e.event?.eventName ?? '—'}</p>
                        <p className="text-xs text-gray-400">{(e.category ?? '').replace(/_/g, ' ')}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                        ${Number(e.amountUsd).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusToBadgeVariant(e.status)}>
                          {e.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      {/* Action cell: z-20 sits above the overlay link */}
                      <td className="px-4 py-3">
                        <div className="relative z-20 flex items-center gap-2">
                          {isPending ? (
                            <ExpenseApproveActions expenseId={e.id} />
                          ) : (
                            <Link
                              href={detailHref}
                              className="text-sm font-medium text-indigo-600 hover:underline whitespace-nowrap"
                            >
                              View →
                            </Link>
                          )}
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
    </div>
  )
}
