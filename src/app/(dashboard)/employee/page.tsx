import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function EmployeeDashboard() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId
  const userId = session.user.id

  const [travelRequests, expenses] = await Promise.all([
    prisma.travelRequest.findMany({
      where: { companyId, employeeId: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { event: { select: { eventName: true } } },
    }),
    prisma.expense.findMany({
      where: { companyId, employeeId: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { event: { select: { eventName: true } } },
    }),
  ])

  const totalPending = expenses.filter((e) => ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)).length
  const totalApproved = expenses.filter((e) => e.status === 'APPROVED').length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {session.user.name}</h1>
        <p className="mt-1 text-gray-500">Here&apos;s what&apos;s happening with your travel and expenses.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pending expenses', value: totalPending, color: 'text-yellow-600' },
          { label: 'Approved expenses', value: totalApproved, color: 'text-green-600' },
          { label: 'Active travel requests', value: travelRequests.filter((r) => !['APPROVED', 'REJECTED', 'CANCELLED'].includes(r.status)).length, color: 'text-blue-600' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`mt-1 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/employee/travel-requests/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          + New travel request
        </Link>
        <Link href="/employee/expenses?add=1" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          + Add expense
        </Link>
      </div>

      {/* Recent travel requests */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Recent travel requests</h2>
        {travelRequests.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No travel requests yet.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {travelRequests.map((r) => (
                <Link key={r.id} href={`/employee/travel-requests/${r.id}`} className="block rounded-xl border bg-white px-4 py-3 space-y-1.5 hover:bg-gray-50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 truncate">{r.destination}</p>
                    <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xs text-gray-400">{r.event.eventName}</p>
                  <p className="text-xs text-gray-400">{r.createdAt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
                </Link>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-hidden rounded-xl border bg-white">
              <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Destination</th>
                    <th className="px-4 py-3 text-left">Event</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {travelRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link href={`/employee/travel-requests/${r.id}`} className="hover:text-indigo-600">{r.destination}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.event.eventName}</td>
                      <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-4 py-3 text-gray-400">{r.createdAt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Recent expenses */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Recent expenses</h2>
        {expenses.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No expenses yet.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {expenses.map((e) => (
                <Link key={e.id} href={`/employee/expenses/${e.id}`} className="block rounded-xl border bg-white px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 truncate">{e.description}</p>
                    <p className="font-semibold text-gray-900 shrink-0">${Number(e.amountUsd).toFixed(2)}</p>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-gray-400">{e.event.eventName}</p>
                    <Badge variant={statusToBadgeVariant(e.status)}>{e.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-hidden rounded-xl border bg-white">
              <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Event</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link href={`/employee/expenses/${e.id}`} className="hover:text-indigo-600">{e.description}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{e.event.eventName}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">${Number(e.amountUsd).toFixed(2)}</td>
                      <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(e.status)}>{e.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
