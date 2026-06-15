'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Mail } from 'lucide-react'
import { DateInput } from '@/components/ui/DateInput'

interface TravelRequest {
  id: string
  status: string
  origin: string
  destination: string
  travelDates: { departureDate: string; returnDate: string }
  servicesRequested: string[]
  estimatedCostUsd: number | null
  agentId: string | null
  createdAt: string
  employee: { name: string; email: string }
  event: { eventCode: string; eventName: string }
}

function urgencyLabel(status: string, departureDate: string): { label: string; pill: string; border: string } {
  const today = new Date()
  const dep = new Date(departureDate)
  const days = Math.ceil((dep.getTime() - today.getTime()) / 86400000)

  if (status === 'PENDING_AGENT' && days <= 7 && days >= 0) {
    return { label: 'Urgent', pill: 'bg-red-100 text-red-700 border-red-200', border: 'border-l-4 border-l-red-400' }
  }
  if (status === 'PENDING_AGENT') {
    return { label: 'Pending', pill: 'bg-amber-100 text-amber-700 border-amber-200', border: '' }
  }
  if (status === 'APPROVED') {
    return { label: 'Approved', pill: 'bg-green-100 text-green-700 border-green-200', border: 'border-l-4 border-l-green-400' }
  }
  if (status === 'BOOKING_CONFIRMED') {
    return { label: 'Completed', pill: 'bg-indigo-100 text-indigo-700 border-indigo-200', border: '' }
  }
  if (status === 'OPTIONS_PROVIDED' || status === 'PENDING_MANAGER') {
    return { label: 'Awaiting Approval', pill: 'bg-blue-100 text-blue-700 border-blue-200', border: 'border-l-4 border-l-blue-400' }
  }
  if (status === 'REJECTED') return { label: 'Rejected', pill: 'bg-red-100 text-red-600 border-red-200', border: '' }
  if (status === 'CANCELLED') return { label: 'Cancelled', pill: 'bg-gray-100 text-gray-500 border-gray-200', border: '' }
  return { label: status.replace(/_/g, ' '), pill: 'bg-gray-100 text-gray-600 border-gray-200', border: '' }
}

function exportCsv(r: TravelRequest) {
  const dates = r.travelDates as { departureDate: string; returnDate: string }
  const rows = [
    ['Field', 'Value'],
    ['Employee', r.employee.name],
    ['Email', r.employee.email],
    ['Route', `${r.origin} → ${r.destination}`],
    ['Departure', dates.departureDate],
    ['Return', dates.returnDate],
    ['Services', (r.servicesRequested as string[]).join(', ')],
    ['Event', r.event.eventName],
    ['Est. Cost USD', r.estimatedCostUsd ? String(r.estimatedCostUsd) : ''],
    ['Status', r.status],
  ]
  const csv = rows.map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `booking-${r.id.slice(0, 8)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_AGENT', label: 'Pending' },
  { value: 'OPTIONS_PROVIDED', label: 'Options provided' },
  { value: 'PENDING_MANAGER', label: 'Awaiting approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'BOOKING_CONFIRMED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function BookingsContent() {
  const searchParams = useSearchParams()
  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [dateFilter, setDateFilter] = useState('')
  const [view, setView] = useState<'all' | 'mine'>('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/travel-requests').then((r) => r.json()),
      fetch('/api/auth/session').then((r) => r.json()),
    ]).then(([data, session]) => {
      setRequests(Array.isArray(data) ? data : [])
      setCurrentUserId(session?.user?.id ?? null)
      setLoading(false)
    })
  }, [])

  const filtered = requests.filter((r) => {
    const dates = r.travelDates as { departureDate: string; returnDate: string }
    const searchLower = search.toLowerCase()
    const matchesSearch =
      !search ||
      r.employee.name.toLowerCase().includes(searchLower) ||
      r.employee.email.toLowerCase().includes(searchLower) ||
      r.destination.toLowerCase().includes(searchLower) ||
      r.origin.toLowerCase().includes(searchLower) ||
      r.event.eventName.toLowerCase().includes(searchLower)
    const matchesStatus = !statusFilter || r.status === statusFilter
    const matchesDate = !dateFilter || dates.departureDate >= dateFilter
    const matchesMine = view === 'all' || r.agentId === currentUserId
    return matchesSearch && matchesStatus && matchesDate && matchesMine
  })

  const pendingCount = requests.filter((r) => r.status === 'PENDING_AGENT').length
  const urgentCount = requests.filter((r) => {
    if (r.status !== 'PENDING_AGENT') return false
    const dep = new Date((r.travelDates as { departureDate: string }).departureDate)
    const days = Math.ceil((dep.getTime() - Date.now()) / 86400000)
    return days <= 7 && days >= 0
  }).length

  const handleAssign = useCallback(async (id: string) => {
    await fetch(`/api/travel-requests/${id}/assign`, { method: 'POST' })
    const updated = await fetch('/api/travel-requests').then((r) => r.json())
    setRequests(Array.isArray(updated) ? updated : [])
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Requests</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pendingCount} pending
            {urgentCount > 0 && <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{urgentCount} urgent</span>}
          </p>
        </div>
        <Link
          href="/agent/book"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Travel Booking
        </Link>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search employee, destination, event…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            title="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <DateInput
            title="Filter by departure date"
            value={dateFilter}
            onChange={(v) => setDateFilter(v)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
          />

          {/* View toggle */}
          <div className="ml-auto flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setView('all')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${view === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              All requests
            </button>
            <button
              type="button"
              onClick={() => setView('mine')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${view === 'mine' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              My bookings
            </button>
          </div>

          {(search || statusFilter || dateFilter) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter('') }}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500">{filtered.length} request{filtered.length !== 1 ? 's' : ''} found</p>

      {/* Booking cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <p className="text-gray-400">No requests match your filters.</p>
          <button
            type="button"
            onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter(''); setView('all') }}
            className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const dates = r.travelDates as { departureDate: string; returnDate: string }
            const sl = urgencyLabel(r.status, dates.departureDate)
            const isUnassigned = !r.agentId && r.status === 'PENDING_AGENT'
            const isApproved = r.status === 'APPROVED'
            const isMyBooking = r.agentId === currentUserId

            return (
              <div key={r.id} className={`rounded-xl border bg-white p-5 hover:shadow-sm transition-shadow ${sl.border}`}>
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Left — avatar + details (clickable) */}
                  <Link href={`/agent/requests/${r.id}`} className="flex items-start gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                      {r.employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{r.employee.name}</p>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sl.pill}`}>
                          {sl.label}
                        </span>
                        {isMyBooking && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
                            Mine
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm font-medium text-gray-800">
                        {r.origin} → {r.destination}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span>
                          <svg className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {dates.departureDate} → {dates.returnDate}
                        </span>
                        <span>·</span>
                        <span>{(r.servicesRequested as string[]).join(', ')}</span>
                        <span>·</span>
                        <span>{r.event.eventName}</span>
                        {r.estimatedCostUsd && (
                          <>
                            <span>·</span>
                            <span className="font-semibold text-gray-700">${Number(r.estimatedCostUsd).toFixed(0)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Right — actions */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                    {/* Contact employee */}
                    <a
                      href={`mailto:${r.employee.email}?subject=Your travel request: ${r.origin} → ${r.destination}`}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      title={`Email ${r.employee.name}`}
                    >
                      <Mail className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />Contact
                    </a>

                    {/* Export */}
                    <button
                      type="button"
                      onClick={() => exportCsv(r)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      title="Export as CSV"
                    >
                      ↓ Export
                    </button>

                    {/* Accept (unassigned) */}
                    {isUnassigned && (
                      <button
                        type="button"
                        onClick={() => handleAssign(r.id)}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                      >
                        Accept
                      </button>
                    )}

                    {/* Confirm booking (approved) */}
                    {isApproved && isMyBooking && (
                      <Link
                        href={`/agent/requests/${r.id}`}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                      >
                        Confirm
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AgentBookingsPage() {
  return (
    <Suspense>
      <BookingsContent />
    </Suspense>
  )
}
