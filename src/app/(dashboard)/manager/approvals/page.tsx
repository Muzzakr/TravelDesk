export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function ApprovalsPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const [travelRequests, expenses] = await Promise.all([
    prisma.travelRequest.findMany({
      where: { companyId, status: 'PENDING_MANAGER' },
      include: { employee: { select: { name: true } }, event: { select: { eventName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      include: { employee: { select: { name: true } }, event: { select: { eventName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>

      {/* Travel requests */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Travel requests</h2>
        {travelRequests.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No pending travel requests.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {travelRequests.map((r) => (
                <div key={r.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{r.employee.name}</p>
                      <p className="text-sm text-gray-600">{r.origin} → {r.destination}</p>
                      <p className="text-xs text-gray-400">{r.event.eventName}</p>
                    </div>
                    <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <Link href={`/manager/approvals/travel/${r.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Review →</Link>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Route</th>
                    <th className="px-4 py-3 text-left">Event</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {travelRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.employee.name}</td>
                      <td className="px-4 py-3">{r.origin} → {r.destination}</td>
                      <td className="px-4 py-3 text-gray-500">{r.event.eventName}</td>
                      <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-4 py-3">
                        <Link href={`/manager/approvals/travel/${r.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Review</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Expenses */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Expenses</h2>
        {expenses.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No pending expenses.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {expenses.map((ex) => (
                <div key={ex.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{ex.employee.name}</p>
                      <p className="text-sm text-gray-700 truncate">{ex.description}</p>
                      <p className="text-xs text-gray-400">{ex.event.eventName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="font-semibold text-gray-900">${Number(ex.amountUsd).toFixed(2)}</p>
                      <Badge variant={statusToBadgeVariant(ex.status)}>{ex.status}</Badge>
                    </div>
                  </div>
                  <Link href={`/manager/approvals/expense/${ex.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Review →</Link>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenses.map((ex) => (
                    <tr key={ex.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{ex.employee.name}</td>
                      <td className="px-4 py-3 text-gray-700">{ex.description}</td>
                      <td className="px-4 py-3">${Number(ex.amountUsd).toFixed(2)}</td>
                      <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(ex.status)}>{ex.status}</Badge></td>
                      <td className="px-4 py-3">
                        <Link href={`/manager/approvals/expense/${ex.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Review</Link>
                      </td>
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
