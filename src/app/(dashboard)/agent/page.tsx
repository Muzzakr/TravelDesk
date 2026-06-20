export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Inbox, Clock, Clock3, Plane, Check, User } from 'lucide-react'

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

function getBookingUrl(vendor: string, serviceType: string, origin: string, destination: string, departureDate: string) {
  const base = VENDOR_URLS[vendor.toLowerCase()]
  if (base) return base
  const q = encodeURIComponent(`${vendor} ${serviceType.replace('_', ' ')} ${origin} ${destination} ${departureDate}`)
  return `https://www.google.com/search?q=${q}`
}

function statusLabel(status: string, departureDate?: string): { label: string; color: string } {
  const today = new Date()
  if (status === 'PENDING_AGENT') {
    if (departureDate) {
      const dep = new Date(departureDate)
      const days = Math.ceil((dep.getTime() - today.getTime()) / 86400000)
      if (days <= 7) return { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200' }
    }
    return { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200' }
  }
  if (status === 'APPROVED') return { label: 'Approved', color: 'bg-green-100 text-green-700 border-green-200' }
  if (status === 'BOOKING_CONFIRMED') return { label: 'Completed', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
  if (status === 'PENDING_MANAGER' || status === 'OPTIONS_PROVIDED') return { label: 'Awaiting Approval', color: 'bg-blue-100 text-blue-700 border-blue-200' }
  return { label: status.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-600 border-gray-200' }
}

export default async function AgentDashboard() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId
  const agentId = session.user.id
  const today = new Date()

  const [pendingBookings, awaitingApproval, upcomingTrips, completedTrips, myRecentBookings] = await Promise.all([
    prisma.travelRequest.count({ where: { companyId, status: 'PENDING_AGENT' } }),
    prisma.travelRequest.count({ where: { companyId, agentId, status: { in: ['OPTIONS_PROVIDED', 'PENDING_MANAGER'] } } }),
    prisma.travelRequest.count({
      where: {
        companyId, agentId, status: 'BOOKING_CONFIRMED',
        travelDates: { path: ['departureDate'], gte: today.toISOString().split('T')[0] },
      },
    }),
    prisma.travelRequest.count({
      where: {
        companyId, agentId, status: 'BOOKING_CONFIRMED',
        travelDates: { path: ['departureDate'], lt: today.toISOString().split('T')[0] },
      },
    }),
    prisma.travelRequest.findMany({
      where: { companyId, agentId },
      include: {
        employee: { select: { name: true, email: true } },
        event: { select: { eventName: true } },
        bookingOptions: { where: { isSelected: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
  ])

  const [urgentCount, inboxNewCount] = await Promise.all([
    prisma.travelRequest.count({
      where: {
        companyId,
        status: 'PENDING_AGENT',
        travelDates: {
          path: ['departureDate'],
          lte: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        },
      },
    }),
    prisma.travelInboxMessage.count({ where: { companyId, status: 'NEW' } }),
  ])

  const stats = [
    { label: 'Inbox — New',       value: inboxNewCount,   color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-200',    icon: Inbox, href: '/agent/inbox?status=NEW' },
    { label: 'Pending Bookings',  value: pendingBookings, color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: Clock, href: '/agent/bookings?status=PENDING_AGENT' },
    { label: 'Awaiting Approval', value: awaitingApproval, color: 'text-blue-600', bg: 'bg-blue-50',   border: 'border-blue-200',   icon: Clock3, href: '/agent/bookings?status=PENDING_MANAGER' },
    { label: 'Upcoming Trips',    value: upcomingTrips,   color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  icon: Plane, href: '/agent/bookings?status=BOOKING_CONFIRMED' },
    { label: 'Completed Trips',   value: completedTrips,  color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: Check, href: '/agent/bookings?status=BOOKING_CONFIRMED' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {urgentCount > 0
              ? `${urgentCount} urgent booking${urgentCount > 1 ? 's' : ''} need attention`
              : 'All caught up — manage bookings below'}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`rounded-xl border ${s.border} ${s.bg} p-5 hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              {s.label === 'Pending Bookings' && urgentCount > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{urgentCount} urgent</span>
              )}
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs font-medium text-gray-600">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent bookings */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">My recent bookings</h2>
          <Link href="/agent/bookings" className="text-sm font-medium text-indigo-600 hover:underline">View all →</Link>
        </div>

        {myRecentBookings.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center">
            <p className="text-gray-400 text-sm">No bookings assigned yet.</p>
            <Link href="/agent/bookings" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
              Browse available requests →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myRecentBookings.map((r) => {
              const dates = r.travelDates as { departureDate: string; returnDate: string }
              const sl = statusLabel(r.status, dates.departureDate)
              const selectedOptions = r.bookingOptions
              return (
                <div key={r.id} className={`rounded-xl border bg-white p-5 hover:shadow-sm transition-shadow ${sl.label === 'Urgent' ? 'border-l-4 border-l-red-400' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Avatar + info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                        {r.employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{r.employee.name}</p>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sl.color}`}>
                            {sl.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-gray-600 font-medium">{r.origin} → {r.destination}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {dates.departureDate} → {dates.returnDate} · {r.event.eventName}
                        </p>
                        <p className="text-xs text-gray-400">{(r.servicesRequested as string[]).join(', ')}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {r.estimatedCostUsd && (
                        <span className="text-sm font-bold text-gray-700">${Number(r.estimatedCostUsd).toFixed(0)}</span>
                      )}
                      <Link
                        href={`/agent/employees/${r.employee.id}`}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        title="View employee profile"
                      >
                        <User className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />View Profile
                      </Link>
                      <Link
                        href={`/agent/requests/${r.id}`}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                      >
                        View →
                      </Link>
                    </div>
                  </div>

                  {/* Selected options with booking links */}
                  {selectedOptions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Selected options — click to book</p>
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
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
