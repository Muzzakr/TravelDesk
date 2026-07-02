'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

type Expense = {
  id: string; status: string; amountUsd: string | number
  description: string; category: string; merchantName: string | null; createdAt: string
  employee: { id: string; name: string }
  event: { eventCode: string; eventName: string }
  receipts: { id: string; fileName: string }[]
}

type PageData = {
  expenses: Expense[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  kpis: {
    totalExpensesAmount: number; totalExpensesCount: number
    pendingManagerReviewAmount: number; pendingManagerReviewCount: number
    awaitingPaymentAmount: number; awaitingPaymentCount: number
    paidThisMonthAmount: number; paidThisMonthCount: number
  }
  employees: { id: string; name: string }[]
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'Pending Review' },
  { value: 'APPROVED', label: 'Awaiting Payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DRAFT', label: 'Draft' },
]

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Pending Review', UNDER_REVIEW: 'Under Review',
  APPROVED: 'Awaiting Payment', PAID: 'Paid', REJECTED: 'Rejected', DRAFT: 'Draft',
}

export default function AdminExpensesPage() {
  const now = new Date()
  const [month, setMonth] = useState(-1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('SUBMITTED')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Approve / reject
  const [acting, setActing] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectErr, setRejectErr] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({
      ...(month >= 0 && { month: String(month + 1) }),
      year: String(year),
      page: String(page),
      ...(statusFilter && { status: statusFilter }),
      ...(employeeFilter && { employeeId: employeeFilter }),
      ...(search && { search }),
    })
    const res = await fetch(`/api/finance/expenses?${p}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [month, year, page, statusFilter, employeeFilter, search])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [month, year, statusFilter, employeeFilter, search])

  async function approve(id: string) {
    setActing(id)
    await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    })
    fetchData()
    setActing(null)
  }

  async function reject(id: string) {
    if (!rejectNote.trim()) return
    setActing(id)
    const r = await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED', rejectionNote: rejectNote }),
    })
    if (!r.ok) {
      const d = await r.json()
      setRejectErr(d.error ?? 'Failed to reject')
    } else {
      setRejectId(null); setRejectNote(''); setRejectErr('')
      fetchData()
    }
    setActing(null)
  }

  function exportCSV() {
    if (!data?.expenses.length) return
    const rows = data.expenses.map(e => [
      new Date(e.createdAt).toISOString().slice(0, 10),
      e.employee.name, e.description, e.merchantName ?? '',
      e.category, e.event.eventName, e.event.eventCode,
      Number(e.amountUsd).toFixed(2), STATUS_LABELS[e.status] ?? e.status,
    ])
    const header = ['Date','Employee','Description','Merchant','Category','Event','Event Code','Amount (USD)','Status']
    const csv = [header, ...rows].map(r => r.map(v => JSON.stringify(v)).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `expenses-admin-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const kpis = data?.kpis
  const years = [now.getFullYear() - 1, now.getFullYear()]

  const kpiCards = kpis ? [
    {
      label: 'Total expenses',
      value: `$${kpis.totalExpensesAmount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      sub: `${kpis.totalExpensesCount} expenses`,
      color: 'text-gray-900',
    },
    {
      label: 'Awaiting approval',
      value: `$${kpis.pendingManagerReviewAmount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      sub: `${kpis.pendingManagerReviewCount} expenses`,
      color: 'text-yellow-600',
    },
    {
      label: 'Approved (awaiting pay)',
      value: `$${kpis.awaitingPaymentAmount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      sub: `${kpis.awaitingPaymentCount} approved`,
      color: 'text-blue-700',
    },
    {
      label: 'Paid',
      value: `$${kpis.paidThisMonthAmount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      sub: `${kpis.paidThisMonthCount} paid`,
      color: 'text-green-700',
    },
  ] : []

  return (
    <div className="space-y-5">

      {/* Reject modal */}
      {rejectId && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/40" onClick={() => { setRejectId(null); setRejectNote(''); setRejectErr('') }} />
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
            <div className="pointer-events-auto w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Reject expense</h2>
              <textarea rows={3} placeholder="Reason for rejection (required)"
                value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none resize-none" />
              {rejectErr && <p className="text-sm text-red-600">{rejectErr}</p>}
              <div className="flex gap-3">
                <button type="button" disabled={!rejectNote.trim() || acting === rejectId}
                  onClick={() => reject(rejectId!)}
                  className="rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 min-h-[44px]">
                  {acting === rejectId ? 'Rejecting…' : 'Reject'}
                </button>
                <button type="button" onClick={() => { setRejectId(null); setRejectNote(''); setRejectErr('') }}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 min-h-[44px]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">All expenses across your team</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <select title="Month" value={month} onChange={e => { setMonth(Number(e.target.value)); setPage(1) }} className="bg-transparent text-sm focus:outline-none">
              <option value={-1}>All months</option>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select title="Year" value={year} onChange={e => setYear(Number(e.target.value))} className="bg-transparent text-sm focus:outline-none">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button type="button" onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiCards.map(card => (
          <div key={card.label} className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select title="Filter by status" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select title="Filter by employee" value={employeeFilter} onChange={e => { setEmployeeFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All employees</option>
          {data?.employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>

        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 flex-1 min-w-[200px]">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
            placeholder="Search employee, description, event…" className="text-sm flex-1 focus:outline-none bg-transparent" />
        </div>
        {(statusFilter !== 'SUBMITTED' || employeeFilter || search) && (
          <button type="button" onClick={() => { setStatusFilter('SUBMITTED'); setEmployeeFilter(''); setSearch(''); setSearchInput(''); setPage(1) }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">Clear</button>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></div>
          ))
        ) : !data?.expenses.length ? (
          <p className="text-center text-sm text-gray-400 py-8">No expenses found.</p>
        ) : data.expenses.map(e => (
          <div key={e.id} className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm">{e.employee.name}</p>
                <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{e.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">{e.event.eventName}</p>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <p className="font-bold text-gray-900">${Number(e.amountUsd).toFixed(2)}</p>
                <Badge variant={statusToBadgeVariant(e.status)}>{STATUS_LABELS[e.status] ?? e.status}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-50">
              {e.status === 'SUBMITTED' && (
                <>
                  <button type="button" disabled={acting === e.id} onClick={() => approve(e.id)}
                    className="rounded-xl bg-green-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 min-h-[44px] flex-1">
                    {acting === e.id ? '…' : 'Approve'}
                  </button>
                  <button type="button" onClick={() => { setRejectId(e.id); setRejectNote(''); setRejectErr('') }}
                    className="rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-2.5 text-sm font-medium hover:bg-red-100 min-h-[44px] flex-1">
                    Reject
                  </button>
                </>
              )}
              <Link href={`/manager/approvals/expense/${e.id}`}
                className="text-xs font-medium text-indigo-600 hover:underline px-1 py-2 min-h-[44px] flex items-center">
                View →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left">Employee</th>
                <th className="px-3 py-3 text-left">Expense</th>
                <th className="px-3 py-3 text-left">Event</th>
                <th className="px-3 py-3 text-right">Amount</th>
                <th className="px-3 py-3 text-left">Submitted</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-3 bg-gray-100 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : !data?.expenses.length ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No expenses found.</td></tr>
              ) : data.expenses.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {e.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{e.employee.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-gray-900 max-w-[180px] truncate" title={e.description}>{e.description}</p>
                    {e.merchantName && <p className="text-xs text-gray-400 truncate max-w-[180px]">{e.merchantName}</p>}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    <span className="block max-w-[140px] truncate" title={e.event.eventName}>{e.event.eventName}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">${Number(e.amountUsd).toFixed(2)}</td>
                  <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={statusToBadgeVariant(e.status)}>{STATUS_LABELS[e.status] ?? e.status}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {e.status === 'SUBMITTED' && (
                        <>
                          <button type="button" disabled={acting === e.id} onClick={() => approve(e.id)}
                            className="rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
                            {acting === e.id ? '…' : 'Approve'}
                          </button>
                          <button type="button" onClick={() => { setRejectId(e.id); setRejectNote(''); setRejectErr('') }}
                            className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-100 whitespace-nowrap">
                            Reject
                          </button>
                        </>
                      )}
                      <Link href={`/manager/approvals/expense/${e.id}`}
                        className="text-xs font-medium text-indigo-600 hover:underline whitespace-nowrap">
                        View →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-3 py-3">
            <p className="text-xs text-gray-500">
              Showing {((page - 1) * data.pagination.pageSize) + 1}–{Math.min(page * data.pagination.pageSize, data.pagination.total)} of {data.pagination.total} expenses
            </p>
            <Pagination page={page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}
