export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AgentBookingsPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId
  const agentId = session.user.id

  const [allPending, readyToConfirm, bookings] = await Promise.all([
    prisma.travelRequest.findMany({
      where: { companyId, status: 'PENDING_AGENT' },
      include: {
        employee: { select: { name: true, email: true } },
        event: { select: { eventName: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.travelRequest.findMany({
      where: { companyId, agentId, status: 'APPROVED' },
      include: {
        employee: { select: { name: true, email: true } },
        event: { select: { eventName: true } },
      },
      orderBy: { updatedAt: 'asc' },
    }),
    prisma.travelRequest.findMany({
      where: { companyId, agentId },
      include: {
        employee: { select: { name: true, email: true } },
        event: { select: { eventName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  const byStatus = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1
    return acc
  }, {})

  const unassigned = allPending.filter((r) => !r.agentId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Requests to book</h1>
        <Link href="/agent/book" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          + Book on behalf
        </Link>
      </div>

      {/* Ready to confirm — approved, waiting for actual booking */}
      {readyToConfirm.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-green-700 uppercase tracking-wide">Ready to confirm — booking approved</h2>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {readyToConfirm.map((r) => (
              <div key={r.id} className="rounded-xl border border-green-200 bg-green-50/40 px-4 py-3 space-y-1.5">
                <p className="font-medium text-gray-900">{r.employee.name}</p>
                <p className="text-sm text-gray-600">{r.origin} → {r.destination}</p>
                <p className="text-xs text-gray-500">{r.event.eventName}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">{r.servicesRequested.join(', ')}</p>
                  {r.estimatedCostUsd && <p className="text-xs font-semibold text-gray-700">${Number(r.estimatedCostUsd).toFixed(0)}</p>}
                </div>
                <Link href={`/agent/requests/${r.id}`} className="text-sm font-medium text-green-700 hover:underline">Confirm booking →</Link>
              </div>
            ))}
          </div>
          {/* Desktop */}
          <div className="hidden sm:block overflow-hidden rounded-xl border border-green-200 bg-white">
            <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-green-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">Services</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">Est. cost</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {readyToConfirm.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.employee.name}</td>
                    <td className="px-4 py-3">{r.origin} → {r.destination}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.servicesRequested.join(', ')}</td>
                    <td className="px-4 py-3 text-gray-500">{r.event.eventName}</td>
                    <td className="px-4 py-3">{r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(0)}` : '—'}</td>
                    <td className="px-4 py-3">
                      <Link href={`/agent/requests/${r.id}`} className="text-green-700 text-xs font-medium hover:underline">Confirm booking →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Unassigned requests */}
      {unassigned.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-yellow-700 uppercase tracking-wide">Unassigned — available to pick up</h2>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {unassigned.map((r) => (
              <div key={r.id} className="rounded-xl border border-yellow-200 bg-yellow-50/40 px-4 py-3 space-y-1.5">
                <p className="font-medium text-gray-900">{r.employee.name}</p>
                <p className="text-sm text-gray-600">{r.origin} → {r.destination}</p>
                <p className="text-xs text-gray-500">{r.event.eventName}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">{r.servicesRequested.join(', ')}</p>
                  {r.estimatedCostUsd && <p className="text-xs font-semibold text-gray-700">${Number(r.estimatedCostUsd).toFixed(0)}</p>}
                </div>
                <Link href={`/agent/requests/${r.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Accept →</Link>
              </div>
            ))}
          </div>
          {/* Desktop */}
          <div className="hidden sm:block overflow-hidden rounded-xl border border-yellow-200 bg-white">
            <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-yellow-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">Services</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">Est. cost</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {unassigned.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.employee.name}</td>
                    <td className="px-4 py-3">{r.origin} → {r.destination}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.servicesRequested.join(', ')}</td>
                    <td className="px-4 py-3 text-gray-500">{r.event.eventName}</td>
                    <td className="px-4 py-3">{r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(0)}` : '—'}</td>
                    <td className="px-4 py-3">
                      <Link href={`/agent/requests/${r.id}`} className="text-indigo-600 text-xs font-medium hover:underline">Accept →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {unassigned.length === 0 && readyToConfirm.length === 0 && (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No requests currently need your action.</div>
      )}

      <div className="flex flex-wrap gap-3">
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className="rounded-lg bg-white px-4 py-3 shadow-sm border">
            <p className="text-xs text-gray-500">{status.replace(/_/g, ' ')}</p>
            <p className="text-2xl font-bold text-indigo-600">{count}</p>
          </div>
        ))}
      </div>

      {/* My bookings */}
      {bookings.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-800">My bookings</h2>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {bookings.map((b) => (
              <Link key={b.id} href={`/agent/requests/${b.id}`} className="block rounded-xl border bg-white px-4 py-3 hover:bg-gray-50 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{b.employee.name}</p>
                    <p className="text-sm text-gray-600">{b.origin} → {b.destination}</p>
                    <p className="text-xs text-gray-400">{b.event.eventName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={statusToBadgeVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge>
                    {b.estimatedCostUsd && <p className="mt-1 text-xs font-semibold text-gray-700">${Number(b.estimatedCostUsd).toFixed(0)}</p>}
                  </div>
                </div>
                <p className="text-xs text-gray-400">{new Date(b.updatedAt).toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
          {/* Desktop */}
          <div className="hidden sm:block overflow-hidden rounded-xl border bg-white">
            <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">Services</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">Est. cost</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/agent/requests/${b.id}`} className="font-medium text-gray-900 hover:text-indigo-600">{b.employee.name}</Link>
                      <p className="text-xs text-gray-400">{b.employee.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.origin} → {b.destination}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{b.servicesRequested.join(', ')}</td>
                    <td className="px-4 py-3 text-gray-500">{b.event.eventName}</td>
                    <td className="px-4 py-3">{b.estimatedCostUsd ? `$${Number(b.estimatedCostUsd).toFixed(0)}` : '—'}</td>
                    <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(b.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
