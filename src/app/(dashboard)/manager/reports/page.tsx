'use client'

import { useState, useEffect } from 'react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

type TravelRow = {
  id: string
  employee: string
  origin: string
  destination: string
  status: string
  estimatedCostUsd: number | null
  createdAt: string
  event: string
}

type ExpenseRow = {
  id: string
  employee: string
  description: string
  category: string
  amountUsd: number
  status: string
  createdAt: string
  event: string
}

type ReportData = {
  travel: TravelRow[]
  expenses: ExpenseRow[]
  summary: {
    totalTravel: number
    totalExpenses: number
    approvedTravel: number
    approvedExpenses: number
    rejectedTravel: number
    rejectedExpenses: number
    totalSpend: number
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ReportsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [tab, setTab] = useState<'travel' | 'expenses' | 'summary'>('summary')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchReport()
  }, [month, year])

  async function fetchReport() {
    setLoading(true)
    try {
      const res = await fetch(`/api/manager/reports?month=${month + 1}&year=${year}`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } finally {
      setLoading(false)
    }
  }

  function exportCSV(rows: Record<string, unknown>[], filename: string) {
    if (rows.length === 0) return
    const keys = Object.keys(rows[0])
    const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const years = [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Monthly Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Travel and expense reports for your team</p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white border border-gray-100 shadow-sm px-5 py-4">
        <span className="text-sm font-medium text-gray-700">Report Period:</span>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {data && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => exportCSV(
                (tab === 'travel' ? data.travel : data.expenses).map((r) => ({ ...r })),
                `report-${MONTHS[month]}-${year}-${tab}.csv`
              )}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 font-medium"
            >
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Travel Requests', value: data.summary.totalTravel, color: 'text-blue-700' },
            { label: 'Total Expenses', value: data.summary.totalExpenses, color: 'text-indigo-700' },
            { label: 'Approved (Travel)', value: data.summary.approvedTravel, color: 'text-green-700' },
            { label: 'Approved (Expenses)', value: data.summary.approvedExpenses, color: 'text-green-700' },
            { label: 'Rejected (Travel)', value: data.summary.rejectedTravel, color: 'text-red-600' },
            { label: 'Rejected (Expenses)', value: data.summary.rejectedExpenses, color: 'text-red-600' },
            { label: 'Total Spend', value: `$${data.summary.totalSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-gray-900' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(['summary', 'travel', 'expenses'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">Loading report...</div>
      ) : !data ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">No data available.</div>
      ) : tab === 'summary' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Approved vs Rejected Travel */}
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Travel Requests — {MONTHS[month]} {year}</h3>
            {data.travel.length === 0 ? (
              <p className="text-sm text-gray-400">No travel requests this month.</p>
            ) : (
              <div className="space-y-2">
                {['APPROVED', 'BOOKING_CONFIRMED', 'PENDING_MANAGER', 'PENDING_AGENT', 'REJECTED', 'CANCELLED'].map((status) => {
                  const count = data.travel.filter((r) => r.status === status).length
                  if (count === 0) return null
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant={statusToBadgeVariant(status)}>{status.replace(/_/g, ' ')}</Badge>
                      <span className="text-sm font-semibold text-gray-900">{count}</span>
                    </div>
                  )
                })}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="text-gray-700">Est. Total Cost</span>
                    <span className="text-gray-900">
                      ${data.travel.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Approved vs Rejected Expenses */}
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Expenses — {MONTHS[month]} {year}</h3>
            {data.expenses.length === 0 ? (
              <p className="text-sm text-gray-400">No expenses this month.</p>
            ) : (
              <div className="space-y-2">
                {['APPROVED', 'PAID', 'SUBMITTED', 'UNDER_REVIEW', 'REJECTED'].map((status) => {
                  const count = data.expenses.filter((e) => e.status === status).length
                  if (count === 0) return null
                  const total = data.expenses.filter((e) => e.status === status).reduce((s, e) => s + e.amountUsd, 0)
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant={statusToBadgeVariant(status)}>{status.replace(/_/g, ' ')}</Badge>
                      <span className="text-sm font-semibold text-gray-900">
                        {count} · ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )
                })}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="text-gray-700">Total Amount</span>
                    <span className="text-gray-900">
                      ${data.expenses.reduce((s, e) => s + e.amountUsd, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : tab === 'travel' ? (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Route</th>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-right">Est. Cost</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.travel.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No travel requests this month.</td></tr>
              ) : data.travel.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.employee}</td>
                  <td className="px-4 py-3">{r.origin} → {r.destination}</td>
                  <td className="px-4 py-3 text-gray-500">{r.event}</td>
                  <td className="px-4 py-3 text-right">{r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(0)}` : '—'}</td>
                  <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.expenses.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No expenses this month.</td></tr>
              ) : data.expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{e.employee}</td>
                  <td className="px-4 py-3 text-gray-700">{e.description}</td>
                  <td className="px-4 py-3 text-gray-500">{e.category || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{e.event}</td>
                  <td className="px-4 py-3 text-right font-medium">${Number(e.amountUsd).toFixed(2)}</td>
                  <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(e.status)}>{e.status.replace(/_/g, ' ')}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
