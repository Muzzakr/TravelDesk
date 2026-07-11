'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { Plane, Clock, CheckCircle, Calendar } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import { LoadError } from '@/components/ui/LoadError'

type TravelRequest = {
  id: string
  origin: string
  destination: string
  status: string
  travelDates: { departureDate: string; returnDate: string }
  servicesRequested: string[]
  estimatedCostUsd: string | number | null
  createdAt: string
  employee: { id: string; name: string; email: string }
  event: { eventName: string; eventCode: string }
  agent: { id: string; name: string } | null
  manager: { id: string; name: string } | null
}

type PageData = {
  requests: TravelRequest[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  counts: { total: number; pending: number; approved: number; confirmed: number }
  employees: { id: string; name: string }[]
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_MANAGER', label: 'Pending manager' },
  { value: 'PENDING_AGENT', label: 'Pending agent' },
  { value: 'OPTIONS_PROVIDED', label: 'Options provided' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'BOOKING_CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function formatDate(s: string | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TeamTravelPage() {
  const router = useRouter()
  const [data, setData]               = useState<PageData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [status, setStatus]           = useState('')
  const [employeeId, setEmployeeId]   = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')
  const [page, setPage]               = useState(1)
  const [loadError, setLoadError]     = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const p = new URLSearchParams()
      if (status)     p.set('status', status)
      if (employeeId) p.set('employeeId', employeeId)
      if (search)     p.set('search', search)
      p.set('page', String(page))
      const res = await fetch(`/api/manager/travel-requests?${p}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [status, employeeId, search, page])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [status, employeeId, search])

  function applySearch() { setSearch(searchInput); setPage(1) }

  function exportCSV() {
    if (!data?.requests.length) return
    const rows = data.requests.map(r => [
      r.employee.name, r.employee.email,
      `${r.origin} → ${r.destination}`,
      r.event.eventName, r.event.eventCode,
      r.servicesRequested.join('; '),
      r.status,
      (r.travelDates as Record<string, string>).departureDate,
      (r.travelDates as Record<string, string>).returnDate,
      r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(2)}` : '',
      new Date(r.createdAt).toISOString().slice(0, 10),
    ])
    const header = ['Employee','Email','Route','Event','Event Code','Services','Status','Departure','Return','Est. Cost','Submitted']
    const csv = [header, ...rows].map(r => r.map(v => JSON.stringify(v ?? '')).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `travel-requests-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const kpis = data?.counts
  const KPI_CARDS = [
    { label: 'Total requests', value: kpis?.total    ?? 0, Icon: Plane,        color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Pending',        value: kpis?.pending  ?? 0, Icon: Clock,        color: 'bg-amber-50 text-amber-600' },
    { label: 'Approved',       value: kpis?.approved ?? 0, Icon: CheckCircle,  color: 'bg-green-50 text-green-600' },
    { label: 'Confirmed',      value: kpis?.confirmed ?? 0, Icon: Calendar,    color: 'bg-blue-50 text-blue-600' },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">All travel requests across your team</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-500">{data?.pagination.total ?? 0} total</span>
          <button type="button" onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Export CSV
          </button>
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
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          title="Filter by status"
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:border-indigo-500 outline-none"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {data && (
          <select
            title="Filter by employee"
            value={employeeId}
            onChange={e => { setEmployeeId(e.target.value); setPage(1) }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:border-indigo-500 outline-none"
          >
            <option value="">All employees</option>
            {data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}

        <div className="flex gap-1 flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search employee, route, event…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch()}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm flex-1 focus:border-indigo-500 outline-none"
          />
          <button type="button" onClick={applySearch}
            className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">
            Search
          </button>
          {(status || employeeId || search) && (
            <button type="button" onClick={() => { setStatus(''); setEmployeeId(''); setSearch(''); setSearchInput(''); setPage(1) }}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {loadError && !loading && <LoadError onRetry={fetchData} />}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></div>
          ))
        ) : loadError ? null : (data?.requests.length ?? 0) === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No requests found.</p>
        ) : data?.requests.map(r => {
          const dates = r.travelDates as Record<string, string>
          return (
            <Link key={r.id} href={`/manager/approvals/travel/${r.id}`}
              className="block rounded-xl border bg-white px-4 py-3 space-y-2 hover:border-indigo-200 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{r.origin} → {r.destination}</p>
                  <p className="text-xs text-gray-500">{r.employee.name} · {r.event.eventName}</p>
                </div>
                <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{formatDate(dates.departureDate)} → {formatDate(dates.returnDate)}</span>
                {r.estimatedCostUsd && <span className="font-semibold text-gray-700">${Number(r.estimatedCostUsd).toFixed(0)}</span>}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-gray-400">Loading…</p>
        ) : loadError ? (
          <p className="p-8 text-center text-gray-400">—</p>
        ) : (data?.requests.length ?? 0) === 0 ? (
          <p className="p-8 text-center text-gray-400">No requests found.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Route</th>
                <th className="px-4 py-3 text-left">Services</th>
                <th className="px-4 py-3 text-left">Dates</th>
                <th className="px-4 py-3 text-left">Est. Cost</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.requests.map(r => {
                const dates = r.travelDates as Record<string, string>
                return (
                  <tr key={r.id} onClick={() => router.push(`/manager/approvals/travel/${r.id}`)}
                    className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.employee.name}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[160px]">{r.employee.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.origin} → {r.destination}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[180px]" title={r.event.eventName}>{r.event.eventName}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.servicesRequested.join(', ')}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(dates.departureDate)}<br />{formatDate(dates.returnDate)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 whitespace-nowrap">
                      {r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(0)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-gray-500 text-xs">
            Showing {((page - 1) * data.pagination.pageSize) + 1}–{Math.min(page * data.pagination.pageSize, data.pagination.total)} of {data.pagination.total}
          </span>
          <Pagination page={page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
