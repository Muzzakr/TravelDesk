import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { EscalateButton } from './EscalateButton'

export default async function FinanceDashboard() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const [reports, pendingExpenses, events] = await Promise.all([
    prisma.payoutReport.findMany({
      where: { companyId },
      orderBy: { generatedAt: 'desc' },
      take: 10,
    }),
    prisma.expense.findMany({
      where: { companyId, status: 'APPROVED', payoutReportId: null },
      include: {
        employee: { select: { name: true } },
        event: { select: { eventName: true, eventCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.event.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true, eventName: true, budgetUsd: true, approvedSpendUsd: true },
    }),
  ])

  const totalPending = pendingExpenses.reduce((s, e) => s + Number(e.amountUsd), 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Finance dashboard</h1>
        <EscalateButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Approved, awaiting payout</p>
          <p className="mt-1 text-3xl font-bold text-green-600">${totalPending.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Payout reports total</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{reports.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active events</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{events.length}</p>
        </div>
      </div>

      {/* Pending expenses */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Pending expenses — awaiting payout</h2>
        {pendingExpenses.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No approved expenses pending payout.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Merchant</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{e.employee.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      <span className="font-mono text-xs text-gray-400 mr-1">{e.event.eventCode}</span>
                      {e.event.eventName}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{e.category.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-gray-500">{e.merchantName ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">${Number(e.amountUsd).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Event budget tracker */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Event budget tracker</h2>
        <div className="space-y-3">
          {events.map((ev) => {
            const budget = Number(ev.budgetUsd)
            const spent = Number(ev.approvedSpendUsd)
            const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
            const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
            return (
              <div key={ev.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-900">{ev.eventName}</span>
                  <span className="text-gray-500">${spent.toFixed(0)} / ${budget.toFixed(0)} ({pct}%)</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                  <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Payout reports */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Payout reports</h2>
          <Link href="/finance/payout-reports" className="text-sm font-medium text-indigo-600 hover:underline">View all →</Link>
        </div>
        {reports.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No payout reports yet.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border bg-white px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                    </p>
                    <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xl font-bold text-gray-900">${Number(r.totalUsd).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">Generated {new Date(r.generatedAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-hidden rounded-xl border bg-white">
              <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-left">Total</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">${Number(r.totalUsd).toFixed(2)}</td>
                      <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-4 py-3 text-gray-400">{new Date(r.generatedAt).toLocaleDateString()}</td>
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
