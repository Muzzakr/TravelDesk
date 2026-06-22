'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

interface Event { id: string; eventName: string; eventCode: string }
interface Employee { id: string; name: string }

interface StatsData {
  period: { start: string; end: string }
  travelRequests: { total: number; approved: number; pending: number; rejected: number; previousTotal: number; byDay: { date: string; value: number }[] }
  expenses: { total: number; approved: number; pending: number; rejected: number; totalAmount: number; approvedAmount: number; previousTotal: number; previousTotalAmount: number; byCategory: { category: string; count: number; amount: number }[]; byDay: { date: string; value: number }[] }
  financial: { travelCosts: number; expenseCosts: number; combined: number; previousCombined: number }
  pendingApprovals: { id: string; employee: string; type: string; amount: number; date: string; status: string; href: string; event: string }[]
  records: { items: { id: string; status: string; createdAt: string; origin: string; destination: string; estimatedCostUsd: number | null; employee: { name: string }; event: { eventName: string; eventCode: string } }[]; total: number; page: number; pageSize: number }
  rankings: { topEmployees: { id: string; name: string; amount: number; requests: number; expenses: number }[]; topEvents: { id: string; name: string; code: string; spend: number }[]; topDestinations: { destination: string; count: number }[]; topCategories: { category: string; count: number; amount: number }[] }
  eventAnalytics: { eventName: string; travelRequests: number; expenses: number; totalExpenseCost: number; budget: number; approvedSpend: number; approvalRate: number } | null
  employeeAnalytics: { employeeName: string; totalRequests: number; totalExpenses: number; totalAmount: number; monthlySpend: { month: string; amount: number }[]; recentRequests: { id: string; status: string; origin: string; destination: string; createdAt: string }[]; recentExpenses: { id: string; status: string; amountUsd: number; category: string; createdAt: string }[] } | null
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtUsd(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function TrendBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0) return <span className="text-xs text-gray-400">{label}: no prior data</span>
  const pct = Math.round(((current - previous) / previous) * 100)
  const up = pct >= 0
  return (
    <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold bg-white">
      <span className="text-gray-500">{label}</span>
      <span className={up ? 'text-green-600' : 'text-red-600'}>
        {up ? '↑' : '↓'} {Math.abs(pct)}%
      </span>
    </div>
  )
}

function KPIGroup({ title, color, stats }: { title: string; color: string; stats: { label: string; value: string | number; accent?: boolean }[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${color}`}>{title}</p>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl p-3 ${s.accent ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'}`}>
            <p className={`text-2xl font-bold ${s.accent ? 'text-indigo-700' : 'text-gray-900'}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatsDashboard({ events, employees }: { events: Event[]; employees: Employee[] }) {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'custom'>('monthly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async (p = page, evId = selectedEventId, empId = selectedEmployeeId) => {
    setLoading(true)
    const params = new URLSearchParams({ period, page: String(p) })
    if (period === 'custom' && startDate) params.set('startDate', startDate)
    if (period === 'custom' && endDate) params.set('endDate', endDate)
    if (evId) params.set('eventId', evId)
    if (empId) params.set('employeeId', empId)
    const res = await fetch(`/api/admin/stats?${params}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [period, startDate, endDate, page, selectedEventId, selectedEmployeeId])

  useEffect(() => { load() }, [load])

  async function exportPdf() {
    setExporting(true)
    const params = new URLSearchParams({ period })
    if (period === 'custom' && startDate) params.set('startDate', startDate)
    if (period === 'custom' && endDate) params.set('endDate', endDate)
    const res = await fetch(`/api/admin/stats/pdf?${params}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `statistics-report-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }
    setExporting(false)
  }

  const filteredRecords = data?.records.items.filter(r =>
    !search ||
    r.employee.name.toLowerCase().includes(search.toLowerCase()) ||
    r.destination.toLowerCase().includes(search.toLowerCase()) ||
    r.event.eventName.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Travel request and expense analytics</p>
        </div>
        <button
          type="button" onClick={exportPdf} disabled={exporting || loading}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {exporting ? 'Exporting…' : '↓ Export PDF'}
        </button>
      </div>

      {/* ── Period filter ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">
          {(['weekly', 'monthly', 'custom'] as const).map((p) => (
            <button key={p} type="button" onClick={() => { setPeriod(p); setPage(1) }}
              className={`px-4 py-2.5 min-h-[44px] text-sm font-medium transition-colors capitalize ${period === p ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" title="Start date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" title="End date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button type="button" onClick={() => load(1)}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-indigo-700">Apply</button>
          </div>
        )}
        {loading && <span className="text-xs text-gray-400">Loading…</span>}
      </div>

      {data && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <KPIGroup title="Travel Requests" color="text-amber-600" stats={[
              { label: 'Total', value: data.travelRequests.total, accent: true },
              { label: 'Approved', value: data.travelRequests.approved },
              { label: 'Pending', value: data.travelRequests.pending },
              { label: 'Rejected', value: data.travelRequests.rejected },
            ]} />
            <KPIGroup title="Expenses" color="text-green-600" stats={[
              { label: 'Total', value: data.expenses.total, accent: true },
              { label: 'Approved', value: data.expenses.approved },
              { label: 'Pending', value: data.expenses.pending },
              { label: 'Rejected', value: data.expenses.rejected },
            ]} />
            <KPIGroup title="Financial Overview" color="text-indigo-600" stats={[
              { label: 'Travel Costs', value: fmtUsd(data.financial.travelCosts) },
              { label: 'Expense Costs', value: fmtUsd(data.financial.expenseCosts) },
              { label: 'Combined Total', value: fmtUsd(data.financial.combined), accent: true },
              { label: 'Approved Spend', value: fmtUsd(data.expenses.approvedAmount) },
            ]} />
          </div>

          {/* ── Trend Row ── */}
          <div className="flex flex-wrap gap-3">
            <TrendBadge current={data.travelRequests.total} previous={data.travelRequests.previousTotal} label="Requests" />
            <TrendBadge current={data.expenses.total} previous={data.expenses.previousTotal} label="Expenses" />
            <TrendBadge current={data.financial.combined} previous={data.financial.previousCombined} label="Total Cost" />
          </div>

          {/* ── Charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Requests over time */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">Travel Requests over time</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.travelRequests.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [Number(v), 'Requests']} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Expenses over time */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">Expense spend over time</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.expenses.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${fmt(v)}`} />
                  <Tooltip formatter={(v) => [fmtUsd(Number(v)), 'Spend']} />
                  <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Approved vs Rejected */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">Requests: Approved vs Rejected</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { name: 'Travel Requests', approved: data.travelRequests.approved, rejected: data.travelRequests.rejected, pending: data.travelRequests.pending },
                  { name: 'Expenses', approved: data.expenses.approved, rejected: data.expenses.rejected, pending: data.expenses.pending },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="approved" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="pending" fill="#f59e0b" radius={[4,4,0,0]} />
                  <Bar dataKey="rejected" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category breakdown */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">Expenses by category</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.expenses.byCategory.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${fmt(v)}`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={90} tickFormatter={v => v.replace(/_/g, ' ')} />
                  <Tooltip formatter={(v) => [fmtUsd(Number(v)), 'Amount']} />
                  <Bar dataKey="amount" fill="#6366f1" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Pending Approvals ── */}
          {data.pendingApprovals.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Pending approvals ({data.pendingApprovals.length})</p>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {data.pendingApprovals.map((p) => (
                  <div key={p.id} className="rounded-xl border border-amber-200 bg-white px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{p.employee}</p>
                      {p.amount > 0 && <p className="font-semibold text-gray-800 shrink-0">{fmtUsd(p.amount)}</p>}
                    </div>
                    <p className="text-xs text-gray-500">{p.type} · {p.event}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-400">{new Date(p.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusToBadgeVariant(p.status.replace(/ /g, '_'))}>{p.status}</Badge>
                        <Link href={p.href} className="text-xs font-medium text-indigo-600">View →</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block rounded-2xl border border-amber-200 bg-amber-50/30 overflow-x-auto">
                <table className="w-full text-sm divide-y divide-amber-100">
                  <thead className="bg-amber-50 text-xs font-semibold uppercase text-amber-700">
                    <tr>
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Event</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-50 bg-white">
                    {data.pendingApprovals.map((p) => (
                      <tr key={p.id} className="hover:bg-amber-50/40">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{p.employee}</td>
                        <td className="px-4 py-2.5 text-gray-500">{p.type}</td>
                        <td className="px-4 py-2.5 text-gray-400 max-w-[140px] truncate">{p.event}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-700">{p.amount > 0 ? fmtUsd(p.amount) : '—'}</td>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{new Date(p.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                        <td className="px-4 py-2.5"><Badge variant={statusToBadgeVariant(p.status.replace(/ /g, '_'))}>{p.status}</Badge></td>
                        <td className="px-4 py-2.5">
                          <Link href={p.href} className="text-xs font-medium text-indigo-600 hover:underline">View →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Detailed Records ── */}
          <section>
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Travel requests — {data.records.total} total
              </p>
              <input type="search" placeholder="Search employee, destination, event…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {filteredRecords.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No records found.</p>
              ) : filteredRecords.map((r) => (
                <div key={r.id} className="rounded-xl border border-gray-100 bg-white px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{r.employee.name}</p>
                    {r.estimatedCostUsd && <p className="font-semibold text-gray-800 shrink-0">{fmtUsd(Number(r.estimatedCostUsd))}</p>}
                  </div>
                  <p className="text-xs text-gray-500">{r.origin} → {r.destination}</p>
                  <p className="text-xs text-gray-400 truncate">{r.event.eventCode} — {r.event.eventName}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
                    <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block rounded-2xl border border-gray-100 bg-white overflow-x-auto">
              <table className="min-w-[600px] w-full text-sm divide-y divide-gray-50">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Destination</th>
                    <th className="px-4 py-3 text-left">Event</th>
                    <th className="px-4 py-3 text-right">Est. Cost</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRecords.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No records found.</td></tr>
                  ) : filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.employee.name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.origin} → {r.destination}</td>
                      <td className="px-4 py-2.5 text-gray-400 max-w-[160px] truncate">{r.event.eventCode} — {r.event.eventName}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{r.estimatedCostUsd ? fmtUsd(Number(r.estimatedCostUsd)) : '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                      <td className="px-4 py-2.5"><Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination */}
              {data.records.total > data.records.pageSize && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Page {data.records.page} of {Math.ceil(data.records.total / data.records.pageSize)}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setPage(p => Math.max(1, p - 1)); load(page - 1) }} disabled={data.records.page <= 1}
                      className="rounded-lg border border-gray-200 px-3 py-2.5 min-h-[44px] text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">← Prev</button>
                    <button type="button" onClick={() => { setPage(p => p + 1); load(page + 1) }} disabled={data.records.page * data.records.pageSize >= data.records.total}
                      className="rounded-lg border border-gray-200 px-3 py-2.5 min-h-[44px] text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">Next →</button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Analytics ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Event Analytics */}
            <section className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Event Analytics</p>
              </div>
              <select title="Select event" value={selectedEventId}
                onChange={e => { setSelectedEventId(e.target.value); load(1, e.target.value, selectedEmployeeId) }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">Select an event…</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.eventCode} — {ev.eventName}</option>)}
              </select>
              {data.eventAnalytics ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-indigo-700">{data.eventAnalytics.eventName}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Requests', value: data.eventAnalytics.travelRequests },
                      { label: 'Expenses', value: data.eventAnalytics.expenses },
                      { label: 'Approval Rate', value: `${data.eventAnalytics.approvalRate}%` },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl bg-gray-50 p-3 text-center">
                        <p className="text-xl font-bold text-gray-900">{s.value}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Budget', value: fmtUsd(data.eventAnalytics.budget) },
                      { label: 'Approved Spend', value: fmtUsd(data.eventAnalytics.approvedSpend) },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl bg-indigo-50 p-3">
                        <p className="text-lg font-bold text-indigo-700">{s.value}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-4 text-center">Select an event to view analytics.</p>
              )}
            </section>

            {/* Employee Analytics */}
            <section className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-900">Employee Analytics</p>
              <select title="Select employee" value={selectedEmployeeId}
                onChange={e => { setSelectedEmployeeId(e.target.value); load(1, selectedEventId, e.target.value) }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">Select an employee…</option>
                {employees.map(em => <option key={em.id} value={em.id}>{em.name}</option>)}
              </select>
              {data.employeeAnalytics ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-indigo-700">{data.employeeAnalytics.employeeName}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Requests', value: data.employeeAnalytics.totalRequests },
                      { label: 'Expenses', value: data.employeeAnalytics.totalExpenses },
                      { label: 'Total Spent', value: fmtUsd(data.employeeAnalytics.totalAmount) },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl bg-gray-50 p-3 text-center">
                        <p className="text-lg font-bold text-gray-900">{s.value}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {data.employeeAnalytics.monthlySpend.length > 0 && (
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={data.employeeAnalytics.monthlySpend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `$${fmt(v)}`} />
                        <Tooltip formatter={(v) => [fmtUsd(Number(v)), 'Spend']} />
                        <Bar dataKey="amount" fill="#6366f1" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-4 text-center">Select an employee to view analytics.</p>
              )}
            </section>
          </div>

          {/* ── Top Rankings ── */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Top Rankings</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Top spending employees */}
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Highest Spending Employees</p>
                <ol className="space-y-2">
                  {data.rankings.topEmployees.map((e, i) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-400 w-4 shrink-0">{i+1}.</span>
                      <span className="flex-1 font-medium text-gray-800 truncate">{e.name}</span>
                      <span className="text-indigo-600 font-semibold shrink-0">{fmtUsd(e.amount)}</span>
                    </li>
                  ))}
                  {data.rankings.topEmployees.length === 0 && <li className="text-gray-400 text-xs">No data</li>}
                </ol>
              </div>

              {/* Top events */}
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Most Expensive Events</p>
                <ol className="space-y-2">
                  {data.rankings.topEvents.map((e, i) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-400 w-4 shrink-0">{i+1}.</span>
                      <span className="flex-1 font-medium text-gray-800 truncate">{e.name}</span>
                      <span className="text-green-600 font-semibold shrink-0">{fmtUsd(e.spend)}</span>
                    </li>
                  ))}
                  {data.rankings.topEvents.length === 0 && <li className="text-gray-400 text-xs">No data</li>}
                </ol>
              </div>

              {/* Top destinations */}
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Most Visited Destinations</p>
                <ol className="space-y-2">
                  {data.rankings.topDestinations.map((d, i) => (
                    <li key={d.destination} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-400 w-4 shrink-0">{i+1}.</span>
                      <span className="flex-1 font-medium text-gray-800 truncate">{d.destination}</span>
                      <span className="text-amber-600 font-semibold shrink-0">{d.count}×</span>
                    </li>
                  ))}
                  {data.rankings.topDestinations.length === 0 && <li className="text-gray-400 text-xs">No data</li>}
                </ol>
              </div>

              {/* Top categories */}
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Top Expense Categories</p>
                <ol className="space-y-2">
                  {data.rankings.topCategories.map((c, i) => (
                    <li key={c.category} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-400 w-4 shrink-0">{i+1}.</span>
                      <span className="flex-1 font-medium text-gray-800 truncate">{c.category.replace(/_/g, ' ')}</span>
                      <span className="text-violet-600 font-semibold shrink-0">{fmtUsd(c.amount)}</span>
                    </li>
                  ))}
                  {data.rankings.topCategories.length === 0 && <li className="text-gray-400 text-xs">No data</li>}
                </ol>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
