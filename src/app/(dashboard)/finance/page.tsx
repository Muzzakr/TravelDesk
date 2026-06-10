'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { FinanceCharts } from '@/components/finance/FinanceCharts'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

type Expense = {
  id: string
  description: string
  merchantName: string | null
  amountUsd: number
  status: string
  category: string
  createdAt: string
  employee: { id: string; name: string }
  event: { eventCode: string; eventName: string }
  receipts: { id: string; fileName: string }[]
}

type KPIs = {
  awaitingPaymentAmount: number; awaitingPaymentCount: number
  paidThisMonthAmount: number; paidThisMonthCount: number
  pendingManagerReviewAmount: number; pendingManagerReviewCount: number
  totalExpensesAmount: number; totalExpensesCount: number
  avgProcessingDays: number
}

type Charts = {
  statusDistribution: { status: string; count: number; amount: number }[]
  categoryBreakdown: { category: string; amount: number }[]
}

type DashData = {
  expenses: Expense[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  kpis: KPIs
  charts: Charts
  escalatedCount: number
  employees: { id: string; name: string }[]
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Pending Manager Review',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Awaiting Payment',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  DRAFT: 'Draft',
}

const STATUS_BADGE: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'gray' | 'purple'> = {
  SUBMITTED: 'yellow',
  UNDER_REVIEW: 'yellow',
  APPROVED: 'blue',
  PAID: 'green',
  REJECTED: 'red',
  DRAFT: 'gray',
}

export default function FinanceDashboard() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [escalating, setEscalating] = useState(false)
  const [showEscalated, setShowEscalated] = useState(false)

  const fetch72h = useCallback(async () => {
    setEscalating(true)
    await fetch('/api/finance/escalate', { method: 'POST' })
    setEscalating(false)
    setShowEscalated(true)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      month: String(month + 1), year: String(year),
      page: String(page),
      ...(statusFilter && { status: statusFilter }),
      ...(employeeFilter && { employeeId: employeeFilter }),
      ...(search && { search }),
    })
    const res = await fetch(`/api/finance/expenses?${params}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [month, year, page, statusFilter, employeeFilter, search])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [month, year, statusFilter, employeeFilter, search])

  async function markAsPaid(expenseId: string) {
    setMarkingId(expenseId)
    await fetch('/api/finance/expenses/mark-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenseId }),
    })
    setMarkingId(null)
    fetchData()
  }

  function exportCSV() {
    if (!data?.expenses.length) return
    const rows = data.expenses.map((e) => [
      new Date(e.createdAt).toISOString().slice(0, 10),
      e.employee.name,
      e.description,
      e.merchantName ?? '',
      e.category,
      e.event.eventName,
      Number(e.amountUsd).toFixed(2),
      STATUS_LABELS[e.status] ?? e.status,
    ])
    const header = ['Date', 'Employee', 'Description', 'Merchant', 'Category', 'Event', 'Amount (USD)', 'Status']
    const csv = [header.join(','), ...rows.map((r) => r.map((v) => JSON.stringify(v)).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${MONTHS[month]}-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const years = [now.getFullYear() - 1, now.getFullYear()]
  const kpis = data?.kpis

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here&apos;s what&apos;s happening with your finance operations.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 72h escalation */}
          <button
            type="button"
            onClick={fetch72h}
            disabled={escalating}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            72h escalation
            {data && data.escalatedCount > 0 && (
              <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-bold text-orange-700">
                {data.escalatedCount}
              </span>
            )}
          </button>

          {/* Month picker */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <select title="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-transparent text-sm focus:outline-none">
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select title="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-transparent text-sm focus:outline-none">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Export */}
          <button type="button" onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'Approved, awaiting payout',
            value: kpis ? `$${kpis.awaitingPaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
            sub: kpis ? `${kpis.awaitingPaymentCount} expense${kpis.awaitingPaymentCount !== 1 ? 's' : ''}` : '',
            color: 'text-green-600',
            icon: '✅',
            onClick: () => { setStatusFilter('APPROVED'); setPage(1) },
          },
          {
            label: 'Paid this month',
            value: kpis ? `$${kpis.paidThisMonthAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
            sub: kpis ? `${kpis.paidThisMonthCount} expense${kpis.paidThisMonthCount !== 1 ? 's' : ''}` : '',
            color: 'text-blue-700',
            icon: '💰',
            onClick: () => { setStatusFilter('PAID'); setPage(1) },
          },
          {
            label: 'Pending manager review',
            value: kpis ? `$${kpis.pendingManagerReviewAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
            sub: kpis ? `${kpis.pendingManagerReviewCount} expense${kpis.pendingManagerReviewCount !== 1 ? 's' : ''}` : '',
            color: 'text-orange-600',
            icon: '⏳',
            onClick: () => { setStatusFilter('SUBMITTED'); setPage(1) },
          },
          {
            label: 'Total expenses this month',
            value: kpis ? `$${kpis.totalExpensesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
            sub: kpis ? `${kpis.totalExpensesCount} expense${kpis.totalExpensesCount !== 1 ? 's' : ''}` : '',
            color: 'text-indigo-700',
            icon: '📊',
            onClick: () => { setStatusFilter(''); setPage(1) },
          },
          {
            label: 'Average processing time',
            value: kpis ? `${kpis.avgProcessingDays} days` : '—',
            sub: 'This month',
            color: 'text-purple-700',
            icon: '⚡',
            onClick: undefined,
          },
        ].map((card) => (
          <div
            key={card.label}
            onClick={card.onClick}
            className={`rounded-xl bg-white border border-gray-100 shadow-sm p-4 ${card.onClick ? 'cursor-pointer hover:border-indigo-200 transition-colors' : ''}`}
          >
            <p className="text-xs text-gray-500 leading-tight">{card.label}</p>
            <p className={`mt-1 text-xl font-bold leading-tight ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Main grid: expenses table + charts */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Expenses table — 3/5 width */}
        <div className="xl:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Expenses</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              title="Filter by status"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All status</option>
              <option value="SUBMITTED">Pending Manager Review</option>
              <option value="APPROVED">Awaiting Payment</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <select
              title="Filter by employee"
              value={employeeFilter}
              onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All employees</option>
              {data?.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 flex-1 min-w-[180px]">
              <svg className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
                placeholder="Search expense, employee, event..."
                className="bg-transparent text-xs flex-1 focus:outline-none"
              />
            </div>
            {(statusFilter || employeeFilter || search) && (
              <button type="button" onClick={() => { setStatusFilter(''); setEmployeeFilter(''); setSearch(''); setSearchInput(''); setPage(1) }}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Expense</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Event</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">Submitted</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-center">Receipt</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded animate-pulse w-full" /></td>
                        ))}
                      </tr>
                    ))
                  ) : !data?.expenses.length ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No expenses found.</td></tr>
                  ) : data.expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                            {e.employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900 text-xs whitespace-nowrap">{e.employee.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[120px] truncate text-xs">{e.description}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell max-w-[100px] truncate">{e.event.eventName}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 text-sm whitespace-nowrap">
                        ${Number(e.amountUsd).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${
                          e.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                          e.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          e.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {STATUS_LABELS[e.status] ?? e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {e.receipts.length > 0 ? (
                          <Link href={`/manager/approvals/expense/${e.id}`}>
                            <svg className="h-4 w-4 text-red-400 hover:text-red-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
                            </svg>
                          </Link>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {e.status === 'APPROVED' ? (
                          <button
                            type="button"
                            onClick={() => markAsPaid(e.id)}
                            disabled={markingId === e.id}
                            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {markingId === e.id ? '...' : 'Mark as Paid'}
                          </button>
                        ) : (
                          <Link href={`/manager/approvals/expense/${e.id}`} className="text-xs font-medium text-indigo-600 hover:underline">
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-xs text-gray-500">
                  Showing {((page - 1) * data.pagination.pageSize) + 1} to {Math.min(page * data.pagination.pageSize, data.pagination.total)} of {data.pagination.total} expenses
                </p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">‹</button>
                  {Array.from({ length: Math.min(data.pagination.totalPages, 5) }, (_, i) => {
                    const p = i + 1
                    return (
                      <button type="button" key={p} onClick={() => setPage(p)} className={`rounded px-2.5 py-1 text-xs font-medium ${p === page ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{p}</button>
                    )
                  })}
                  {data.pagination.totalPages > 5 && <span className="text-xs text-gray-400">...</span>}
                  {data.pagination.totalPages > 5 && (
                    <button type="button" onClick={() => setPage(data.pagination.totalPages)} className={`rounded px-2.5 py-1 text-xs font-medium ${data.pagination.totalPages === page ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{data.pagination.totalPages}</button>
                  )}
                  <button type="button" onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))} disabled={page === data.pagination.totalPages} className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">›</button>
                </div>
              </div>
            )}
          </div>

          {/* Payment summary */}
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Payment summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Awaiting payment', value: kpis ? `$${kpis.awaitingPaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—', sub: kpis ? `${kpis.awaitingPaymentCount} expenses` : '', icon: '📤' },
                { label: 'Paid this month', value: kpis ? `$${kpis.paidThisMonthAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—', sub: kpis ? `${kpis.paidThisMonthCount} expenses` : '', icon: '✅' },
                { label: 'Total paid YTD', value: '—', sub: 'Year to date', icon: '📊' },
                { label: 'Rejected this month', value: '—', sub: 'This month', icon: '❌' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{item.value}</p>
                    <p className="text-xs text-gray-400">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts + activity — 2/5 width */}
        <div className="xl:col-span-2 space-y-4">
          {data ? (
            <FinanceCharts
              statusDistribution={data.charts.statusDistribution}
              categoryBreakdown={data.charts.categoryBreakdown}
              onStatusClick={(status) => { setStatusFilter(status); setPage(1) }}
            />
          ) : (
            <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5 h-64 flex items-center justify-center text-sm text-gray-400">
              Loading charts...
            </div>
          )}

          {/* Recent activity */}
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-sm font-semibold text-gray-800">Recent activity</h3>
              <Link href="/finance/expenses" className="text-xs text-indigo-600 hover:underline">View all →</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(!data || loading) ? (
                <div className="px-5 py-4 text-sm text-gray-400">Loading...</div>
              ) : data.expenses.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-start gap-3 px-5 py-3">
                  <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                    e.status === 'PAID' ? 'bg-green-100 text-green-600' :
                    e.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>
                    {e.status === 'PAID' ? '✓' : e.status === 'APPROVED' ? '⏳' : '…'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {e.status === 'PAID' ? 'Expense marked as paid' :
                       e.status === 'APPROVED' ? 'New expense awaiting payment' :
                       'Expense approved by manager'}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">{e.description} · {e.employee.name}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {(() => {
                      const diff = Math.floor((Date.now() - new Date(e.createdAt).getTime()) / 60000)
                      if (diff < 60) return `${diff}m ago`
                      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
                      return `${Math.floor(diff / 1440)}d ago`
                    })()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Escalated modal */}
      {showEscalated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">72h Escalation</h2>
            <p className="text-sm text-gray-600 mb-4">
              {data && data.escalatedCount > 0
                ? `${data.escalatedCount} expense${data.escalatedCount !== 1 ? 's have' : ' has'} been pending for more than 72 hours and have been escalated.`
                : 'No expenses are currently pending beyond 72 hours.'}
            </p>
            <button type="button" onClick={() => setShowEscalated(false)} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
