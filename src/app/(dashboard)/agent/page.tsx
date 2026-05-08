export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const VENDOR_URLS: Record<string, string> = {
  sas: 'https://www.flysas.com',
  norwegian: 'https://www.norwegian.com',
  'british airways': 'https://www.britishairways.com',
  marriott: 'https://www.marriott.com',
  hilton: 'https://www.hilton.com',
  citizenm: 'https://www.citizenm.com',
  hertz: 'https://www.hertz.com',
  avis: 'https://www.avis.com',
  europcar: 'https://www.europcar.com',
}

function getBookingUrl(vendor: string, serviceType: string, origin: string, destination: string, departureDate: string): string {
  const base = VENDOR_URLS[vendor.toLowerCase()]
  if (base) return base
  const q = encodeURIComponent(`${vendor} ${serviceType.replace('_', ' ')} ${origin} ${destination} ${departureDate}`)
  return `https://www.google.com/search?q=${q}`
}

export default async function AgentDashboard() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const pendingBookings = await prisma.travelRequest.findMany({
    where: { companyId, status: 'PENDING_AGENT' },
    include: {
      employee: { select: { name: true, email: true } },
      event: { select: { eventName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const myBookings = await prisma.travelRequest.findMany({
    where: { companyId, agentId: session.user.id },
    include: {
      employee: { select: { name: true } },
      event: { select: { eventName: true } },
      bookingOptions: { where: { isSelected: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Travel agent dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Awaiting booking</p>
          <p className="mt-1 text-3xl font-bold text-yellow-600">{pendingBookings.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">My total bookings</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{myBookings.length}</p>
        </div>
        <Link href="/agent/book" className="rounded-xl bg-indigo-600 p-5 shadow-sm flex flex-col justify-center hover:bg-indigo-700">
          <p className="text-sm text-indigo-100">Book on behalf</p>
          <p className="mt-1 text-lg font-bold text-white">+ New request</p>
        </Link>
      </div>

      {/* Pending bookings */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Requests awaiting booking</h2>
        {pendingBookings.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No requests pending.</div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {pendingBookings.map((r) => (
                <Link key={r.id} href={`/agent/requests/${r.id}`} className="block rounded-xl border bg-white px-4 py-3 hover:bg-gray-50 space-y-1.5">
                  <p className="font-medium text-gray-900">{r.employee.name}</p>
                  <p className="text-sm text-gray-600">{r.origin} → {r.destination}</p>
                  <p className="text-xs text-gray-400">{r.event.eventName} · {(r.servicesRequested as string[]).join(', ')}</p>
                  {r.estimatedCostUsd && <p className="text-sm font-semibold text-gray-900">${Number(r.estimatedCostUsd).toFixed(0)}</p>}
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
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingBookings.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link href={`/agent/requests/${r.id}`} className="hover:text-indigo-600">{r.employee.name}</Link>
                      </td>
                      <td className="px-4 py-3">{r.origin} → {r.destination}</td>
                      <td className="px-4 py-3 text-gray-500">{(r.servicesRequested as string[]).join(', ')}</td>
                      <td className="px-4 py-3 text-gray-500">{r.event.eventName}</td>
                      <td className="px-4 py-3">{r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(0)}` : '—'}</td>
                      <td className="px-4 py-3">
                        <Link href={`/agent/requests/${r.id}`} className="text-indigo-600 text-xs font-medium hover:underline">View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* My bookings */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">My bookings</h2>
        <div className="space-y-3">
          {myBookings.length === 0 ? (
            <div className="overflow-hidden rounded-xl border bg-white p-6 text-sm text-gray-400">No bookings yet.</div>
          ) : myBookings.map((r) => {
            const dates = r.travelDates as { departureDate: string; returnDate: string }
            const selectedOptions = r.bookingOptions
            return (
              <div key={r.id} className="rounded-xl border bg-white p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/agent/requests/${r.id}`} className="text-base font-semibold text-gray-900 hover:text-indigo-600">
                      {r.origin} → {r.destination}
                    </Link>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {r.employee.name} · {r.event.eventName} · {dates.departureDate} → {dates.returnDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                    <Link href={`/agent/requests/${r.id}`} className="text-xs font-medium text-indigo-600 hover:underline">
                      Open →
                    </Link>
                  </div>
                </div>

                {/* Selected options with booking links */}
                {selectedOptions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Selected options — click to book</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {selectedOptions.map((opt) => (
                        <a
                          key={opt.id}
                          href={getBookingUrl(opt.vendor, opt.serviceType, r.origin, r.destination, dates.departureDate)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 hover:bg-indigo-100 transition-colors group"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase text-indigo-400">{opt.serviceType.replace('_', ' ')}</p>
                            <p className="text-sm font-medium text-gray-900 truncate">{opt.vendor}</p>
                            <p className="text-xs text-gray-500 truncate">{opt.description}</p>
                          </div>
                          <div className="ml-3 shrink-0 text-right">
                            <p className="text-sm font-bold text-indigo-700">${Number(opt.priceUsd).toFixed(0)}</p>
                            <p className="text-xs text-indigo-500 group-hover:underline">Book →</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* No options yet */}
                {selectedOptions.length === 0 && ['PENDING_AGENT', 'OPTIONS_PROVIDED'].includes(r.status) && (
                  <p className="mt-3 text-xs text-gray-400">No options selected yet — <Link href={`/agent/requests/${r.id}`} className="text-indigo-500 hover:underline">add options →</Link></p>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
