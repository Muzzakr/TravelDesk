'use client'

import { useState, useEffect } from 'react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { LoadError } from '@/components/ui/LoadError'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

type ReportData = {
  expenses: { id: string; employee: string; description: string; category: string; amountUsd: number; status: string; createdAt: string; event: string }[]
  summary: { totalExpenses: number; approvedExpenses: number; rejectedExpenses: number; totalSpend: number; paidExpenses: number; pendingExpenses: number }
}

export default function FinanceReportsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<'summary' | 'expenses'>('summary')

  useEffect(() => { fetchReport() }, [month, year]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchReport() {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch(`/api/finance/reports?month=${month + 1}&year=${year}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  function exportCSV() {
    if (!data?.expenses.length) return
    const header = ['Date','Employee','Description','Category','Amount (USD)','Status','Event']
    const rows = data.expenses.map((e) => [
      new Date(e.createdAt).toISOString().slice(0, 10), e.employee, e.description,
      e.category, Number(e.amountUsd).toFixed(2), e.status, e.event,
    ])
    const csv = [header.join(','), ...rows.map((r) => r.map((v) => JSON.stringify(v)).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `finance-report-${MONTHS[month]}-${year}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const years = [now.getFullYear() - 1, now.getFullYear()]
  const s = data?.summary

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monthly Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Finance summary for your team</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <select title="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-transparent text-sm focus:outline-none">
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select title="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-transparent text-sm focus:outline-none">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button type="button" onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Expenses', value: s.totalExpenses, color: 'text-gray-900' },
            { label: 'Total Spend', value: `$${s.totalSpend.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`, color: 'text-indigo-700' },
            { label: 'Approved', value: s.approvedExpenses, color: 'text-green-700' },
            { label: 'Paid', value: s.paidExpenses, color: 'text-blue-700' },
            { label: 'Pending', value: s.pendingExpenses, color: 'text-yellow-700' },
            { label: 'Rejected', value: s.rejectedExpenses, color: 'text-red-600' },
          ].map((card) => (
            <div key={card.label} className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(['summary', 'expenses'] as const).map((t) => (
          <button type="button" key={t} onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">Loading report...</div>
      ) : loadError ? (
        <LoadError onRetry={fetchReport} />
      ) : !data ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">No data available.</div>
      ) : tab === 'summary' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Expense Status Breakdown — {MONTHS[month]} {year}</h3>
            {data.expenses.length === 0 ? (
              <p className="text-sm text-gray-400">No expenses this month.</p>
            ) : (
              <div className="space-y-2">
                {['PAID','APPROVED','SUBMITTED','UNDER_REVIEW','REJECTED'].map((status) => {
                  const items = data.expenses.filter((e) => e.status === status)
                  if (!items.length) return null
                  const total = items.reduce((s, e) => s + Number(e.amountUsd), 0)
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant={statusToBadgeVariant(status)}>{status.replace(/_/g,' ')}</Badge>
                      <span className="text-sm font-semibold text-gray-900">{items.length} · ${total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                    </div>
                  )
                })}
                <div className="pt-2 border-t flex justify-between text-sm font-bold">
                  <span className="text-gray-700">Total</span>
                  <span className="text-gray-900">${data.expenses.reduce((s,e) => s+Number(e.amountUsd),0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Spend by Category — {MONTHS[month]} {year}</h3>
            {data.expenses.length === 0 ? (
              <p className="text-sm text-gray-400">No expenses this month.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(
                  data.expenses.reduce((acc: Record<string,number>, e) => {
                    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amountUsd); return acc
                  }, {})
                ).sort(([,a],[,b]) => b - a).map(([cat, total]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 capitalize">{cat.replace(/_/g,' ').toLowerCase()}</span>
                    <span className="text-sm font-semibold text-gray-900">${total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : data.expenses.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">No expenses this month.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {data.expenses.map((e) => (
              <div key={e.id} className="rounded-xl border bg-white px-4 py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-900 text-sm">{e.employee}</p>
                  <span className="font-semibold text-gray-900 whitespace-nowrap shrink-0">${Number(e.amountUsd).toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-700">{e.description}</p>
                <p className="text-xs text-gray-400">{e.category.replace(/_/g,' ').toLowerCase()} · {e.event}</p>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={statusToBadgeVariant(e.status)}>{e.status.replace(/_/g,' ')}</Badge>
                  <span className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white shadow-sm">
            <table className="min-w-[700px] w-full divide-y divide-gray-100 text-sm">
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
                {data.expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{e.employee}</td>
                    <td className="px-4 py-3 text-gray-700">{e.description}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize text-xs">{e.category.replace(/_/g,' ').toLowerCase()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.event}</td>
                    <td className="px-4 py-3 text-right font-medium">${Number(e.amountUsd).toFixed(2)}</td>
                    <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(e.status)}>{e.status.replace(/_/g,' ')}</Badge></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(e.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
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
