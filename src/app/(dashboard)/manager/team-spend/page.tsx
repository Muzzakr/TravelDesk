export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { redirect } from 'next/navigation'

export default async function TeamSpendPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const reports = await prisma.user.findMany({
    where: { companyId, role: 'EMPLOYEE' },
    select: {
      id: true,
      name: true,
      email: true,
      expenses: {
        select: {
          id: true,
          description: true,
          amountUsd: true,
          status: true,
          category: true,
          createdAt: true,
          event: { select: { eventName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  const totals = reports.map((r) => ({
    ...r,
    total: r.expenses.reduce((s, e) => s + Number(e.amountUsd), 0),
    approved: r.expenses.filter((e) => ['APPROVED', 'PAID'].includes(e.status)).reduce((s, e) => s + Number(e.amountUsd), 0),
    pending: r.expenses.filter((e) => ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)).reduce((s, e) => s + Number(e.amountUsd), 0),
  }))

  const grandTotal = totals.reduce((s, r) => s + r.total, 0)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Team spend</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Team members</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{reports.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total expenses</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">${grandTotal.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending approval</p>
          <p className="mt-1 text-3xl font-bold text-yellow-600">
            ${totals.reduce((s, r) => s + r.pending, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {totals.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-gray-400 shadow-sm">
          No employees found.
        </p>
      ) : totals.map((r) => (
        <section key={r.id}>
          <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{r.name}</h2>
              <p className="text-sm text-gray-400">{r.email}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-gray-900">Total: ${r.total.toFixed(2)}</p>
              <p className="text-green-600">Approved: ${r.approved.toFixed(2)}</p>
              <p className="text-yellow-600">Pending: ${r.pending.toFixed(2)}</p>
            </div>
          </div>

          {r.expenses.length === 0 ? (
            <div className="rounded-xl border bg-white p-4 text-sm text-gray-400">No expenses submitted.</div>
          ) : (
            <>
              {/* Mobile */}
              <div className="sm:hidden space-y-2">
                {r.expenses.map((ex) => (
                  <div key={ex.id} className="rounded-xl border bg-white px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900 truncate text-sm">{ex.description}</p>
                      <p className="font-semibold text-gray-900 shrink-0">${Number(ex.amountUsd).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-400">{ex.category} · {ex.event.eventName}</p>
                      <Badge variant={statusToBadgeVariant(ex.status)}>{ex.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-xs text-gray-300">{new Date(ex.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
                <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Event</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {r.expenses.map((ex) => (
                      <tr key={ex.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{ex.description}</td>
                        <td className="px-4 py-3 text-gray-500">{ex.category}</td>
                        <td className="px-4 py-3 text-gray-500">{ex.event.eventName}</td>
                        <td className="px-4 py-3 font-medium">${Number(ex.amountUsd).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusToBadgeVariant(ex.status)}>{ex.status.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(ex.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  )
}
