'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Pagination } from '@/components/ui/Pagination'
import { ExpenseApproveActions } from '@/components/manager/ExpenseApproveActions'
import { FileUpload } from '@/components/ui/FileUpload'
import { compressImageFile } from '@/lib/compress'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const CATEGORIES = [
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'MEALS', label: 'Meals' },
  { value: 'SUPPLIES', label: 'Supplies' },
  { value: 'OTHER', label: 'Other' },
]

// Same service field the employee form sends with POST /api/expenses
const SERVICE_BY_CATEGORY: Record<string, string> = {
  TRANSPORT: 'Transport', ACCOMMODATION: 'Accommodation',
  MEALS: 'Meals', SUPPLIES: 'Supplies', OTHER: 'Other',
}

type Expense = {
  id: string; description: string; merchantName: string | null; amountUsd: number
  status: string; category: string; createdAt: string
  employee: { id: string; name: string }
  event: { eventCode: string; eventName: string }
  receipts: { id: string; fileName: string }[]
}

type TravelEvent = { id: string; eventName: string; eventCode: string }

type PageData = {
  userRole: string
  expenses: Expense[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  kpis: {
    awaitingPaymentAmount: number; awaitingPaymentCount: number
    paidThisMonthAmount: number; paidThisMonthCount: number
    pendingManagerReviewAmount: number; pendingManagerReviewCount: number
    totalExpensesAmount: number; totalExpensesCount: number
  }
  employees: { id: string; name: string }[]
}

const inputCls = 'rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white'

const EMPTY_FORM = {
  employeeId: '', eventId: '', category: '', amountUsd: '', currency: 'USD',
  description: '', merchantName: '', transactionDate: '', reason: '', personName: '',
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Pending Review', UNDER_REVIEW: 'Under Review',
  APPROVED: 'Awaiting Payment', PAID: 'Paid', REJECTED: 'Rejected', DRAFT: 'Draft',
}

const isManagerRole = (role: string) => ['MANAGER', 'TRAVEL_MANAGER'].includes(role)
const isFinanceRole = (role: string) => ['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(role)

export default function FinanceExpensesPage() {
  const now = new Date()
  const [month, setMonth] = useState(-1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [markingId, setMarkingId] = useState<string | null>(null)

  // New expense modal
  const [showNewExpense, setShowNewExpense] = useState(false)
  const [newForm, setNewForm] = useState(EMPTY_FORM)
  const [newError, setNewError] = useState('')
  const [newSubmitting, setNewSubmitting] = useState(false)
  const [newSuccess, setNewSuccess] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [events, setEvents] = useState<TravelEvent[]>([])
  const [eventSearch, setEventSearch] = useState('')
  const [eventDropOpen, setEventDropOpen] = useState(false)
  const eventDropRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({
      ...(month >= 0 && { month: String(month + 1) }), year: String(year), page: String(page),
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

  function openNewExpense() {
    setNewForm(EMPTY_FORM)
    setNewError('')
    setNewSuccess('')
    setPendingFile(null)
    setEventSearch('')
    if (events.length === 0) {
      fetch('/api/events').then(r => r.json()).then((d: TravelEvent[]) =>
        setEvents(d.filter(e => (e as unknown as { status: string }).status !== 'CLOSED'))
      )
    }
    setShowNewExpense(true)
  }

  async function submitNewExpense(e: React.FormEvent) {
    e.preventDefault()
    setNewError('')
    if (!newForm.employeeId) { setNewError('Please select an employee.'); return }
    if (!newForm.eventId) { setNewError('Please select an event.'); return }
    if (!newForm.category) { setNewError('Please select a category.'); return }
    if (!newForm.amountUsd || Number(newForm.amountUsd) <= 0) { setNewError('Please enter a valid amount.'); return }
    if (!newForm.description.trim()) { setNewError('Please enter a description.'); return }
    if (!newForm.reason.trim()) { setNewError('Please enter a reason.'); return }
    if (!pendingFile) { setNewError('A receipt is required — please attach a receipt before submitting.'); return }
    setNewSubmitting(true)

    // Start compression in parallel with the API call — same flow as the employee form
    const compressPromise = compressImageFile(pendingFile)

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newForm,
        service: SERVICE_BY_CATEGORY[newForm.category] ?? 'Other',
        amountUsd: Number(newForm.amountUsd),
      }),
    })
    const resData = await res.json()
    if (!res.ok) {
      setNewError(typeof resData.error === 'string' ? resData.error : JSON.stringify(resData.error))
      setNewSubmitting(false)
      return
    }
    if (resData.expense?.id) {
      const compressed = await compressPromise
      const fd = new FormData()
      fd.append('file', compressed as File)
      fd.append('expenseId', resData.expense.id)
      await fetch('/api/receipts/upload', { method: 'POST', body: fd })
    }
    setNewSubmitting(false)
    setShowNewExpense(false)
    setNewSuccess('Expense created successfully.')
    setTimeout(() => setNewSuccess(''), 4000)
    fetchData()
  }

  const filteredEvents = events.filter(ev =>
    !eventSearch ||
    ev.eventName.toLowerCase().includes(eventSearch.toLowerCase()) ||
    (ev.eventCode ?? '').toLowerCase().includes(eventSearch.toLowerCase())
  )

  async function markAsPaid(expenseId: string) {
    setMarkingId(expenseId)
    await fetch('/api/finance/expenses/mark-paid', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenseId }),
    })
    setMarkingId(null)
    fetchData()
  }

  function exportCSV() {
    if (!data?.expenses.length) return
    const rows = data.expenses.map((e) => [
      new Date(e.createdAt).toISOString().slice(0, 10), e.employee.name, e.description,
      e.merchantName ?? '', e.category, e.event.eventName,
      Number(e.amountUsd).toFixed(2), STATUS_LABELS[e.status] ?? e.status,
    ])
    const header = ['Date','Employee','Description','Merchant','Category','Event','Amount (USD)','Status']
    const csv = [header.join(','), ...rows.map((r) => r.map((v) => JSON.stringify(v)).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `expenses-${month >= 0 ? MONTHS[month] : 'all'}-${year}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const years = [now.getFullYear() - 1, now.getFullYear()]
  const kpis = data?.kpis
  const role = data?.userRole ?? ''
  const isManager = isManagerRole(role)
  const isFinance = isFinanceRole(role)

  const kpiCards = kpis ? [
    {
      label: 'Total expenses',
      value: `$${kpis.totalExpensesAmount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      sub: `${kpis.totalExpensesCount} expenses`,
      color: 'text-gray-900',
    },
    isManager ? {
      label: 'Pending your review',
      value: `$${kpis.pendingManagerReviewAmount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      sub: `${kpis.pendingManagerReviewCount} expenses`,
      color: 'text-yellow-600',
    } : {
      label: 'Awaiting payment',
      value: `$${kpis.awaitingPaymentAmount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      sub: `${kpis.awaitingPaymentCount} expenses`,
      color: 'text-blue-700',
    },
    {
      label: 'Paid',
      value: `$${kpis.paidThisMonthAmount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      sub: `${kpis.paidThisMonthCount} paid`,
      color: 'text-green-700',
    },
    isFinance ? {
      label: 'Generate payout',
      value: '→ Payout Reports',
      sub: 'Create a new report',
      color: 'text-indigo-600',
      href: '/finance/payout-reports',
    } : {
      label: 'Approved (awaiting pay)',
      value: `$${kpis.awaitingPaymentAmount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      sub: `${kpis.awaitingPaymentCount} approved`,
      color: 'text-blue-700',
    },
  ] : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">All expenses across your team</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <select title="Month" value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPage(1) }} className="bg-transparent text-sm focus:outline-none">
              <option value={-1}>All months</option>
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
          {isManager && (
            <button type="button" onClick={openNewExpense}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-sm font-semibold text-white transition-colors">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Expense
            </button>
          )}
        </div>
      </div>

      {newSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {newSuccess}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiCards.map((card) => (
          'href' in card && card.href ? (
            <Link key={card.label} href={card.href} className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 hover:border-indigo-200 transition-colors">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`mt-1 text-base font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </Link>
          ) : (
            <div key={card.label} className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          )
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select title="Filter by status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All statuses</option>
          <option value="SUBMITTED">Pending Review</option>
          <option value="APPROVED">Awaiting Payment</option>
          <option value="PAID">Paid</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select title="Filter by employee" value={employeeFilter} onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All employees</option>
          {data?.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 flex-1 min-w-[200px]">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
            placeholder="Search expense, employee, event..." className="text-sm flex-1 focus:outline-none bg-transparent" />
        </div>
        {(statusFilter || employeeFilter || search) && (
          <button type="button" onClick={() => { setStatusFilter(''); setEmployeeFilter(''); setSearch(''); setSearchInput(''); setPage(1) }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></div>
            ))
          ) : !data?.expenses.length ? (
            <p className="p-8 text-center text-sm text-gray-400">No expenses found.</p>
          ) : data.expenses.map((e) => (
            <div key={e.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{e.employee.name}</p>
                  <p className="text-sm text-gray-600 truncate" title={e.description}>{e.description}</p>
                  <p className="text-xs text-gray-400 truncate">{e.event.eventName}</p>
                </div>
                <span className="font-semibold text-gray-900 whitespace-nowrap shrink-0">${Number(e.amountUsd).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  e.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                  e.status === 'PAID' ? 'bg-green-100 text-green-700' :
                  e.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>{STATUS_LABELS[e.status] ?? e.status}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {isManager && ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status) && (
                    <ExpenseApproveActions expenseId={e.id} onDone={fetchData} />
                  )}
                  {isFinance && e.status === 'APPROVED' && (
                    <button type="button" onClick={() => markAsPaid(e.id)} disabled={markingId === e.id}
                      className="min-h-[2.5rem] rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                      {markingId === e.id ? '...' : 'Mark as Paid'}
                    </button>
                  )}
                  <Link href={`/manager/approvals/expense/${e.id}`} className="text-sm font-medium text-indigo-600 hover:underline">View →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left">Employee</th>
                <th className="px-3 py-3 text-left">Expense</th>
                <th className="px-3 py-3 text-left">Event</th>
                <th className="px-3 py-3 text-right">Amount</th>
                <th className="px-3 py-3 text-left">Submitted</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-center">Receipt</th>
                <th className="px-3 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-3 bg-gray-100 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : !data?.expenses.length ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No expenses found.</td></tr>
              ) : data.expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {e.employee.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{e.employee.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-gray-900 max-w-[180px] truncate" title={e.description}>{e.description}</p>
                    {e.merchantName && <p className="text-xs text-gray-400 max-w-[180px] truncate" title={e.merchantName}>{e.merchantName}</p>}
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs">
                    <span className="block max-w-[140px] truncate" title={e.event.eventName}>{e.event.eventName}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">${Number(e.amountUsd).toFixed(2)}</td>
                  <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      e.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                      e.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      e.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {STATUS_LABELS[e.status] ?? e.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {e.receipts.length > 0 ? (
                      <Link href={`/manager/approvals/expense/${e.id}`} title="View receipt">
                        <svg className="h-5 w-5 text-red-400 hover:text-red-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
                        </svg>
                      </Link>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isManager && ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status) && (
                        <ExpenseApproveActions expenseId={e.id} onDone={fetchData} />
                      )}
                      {isFinance && e.status === 'APPROVED' && (
                        <button type="button" onClick={() => markAsPaid(e.id)} disabled={markingId === e.id}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                          {markingId === e.id ? '...' : 'Mark as Paid'}
                        </button>
                      )}
                      <Link href={`/manager/approvals/expense/${e.id}`} className="text-sm font-medium text-indigo-600 hover:underline">View</Link>
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

      {/* ── New Expense Modal ── */}
      {showNewExpense && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewExpense(false)} />
          <div className="relative w-full sm:max-w-xl max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">New Expense</h2>
              <button type="button" aria-label="Close" onClick={() => setShowNewExpense(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={submitNewExpense} className="px-5 py-5 space-y-4">
              {/* Employee */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Employee<span className="text-red-500 ml-0.5">*</span></label>
                <select title="Employee" value={newForm.employeeId}
                  onChange={e => setNewForm(p => ({ ...p, employeeId: e.target.value }))}
                  className={inputCls}>
                  <option value="">Select employee…</option>
                  {data?.employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>

              {/* Event */}
              <div className="flex flex-col gap-1 relative" ref={eventDropRef}>
                <label className="text-sm font-medium text-gray-700">Event<span className="text-red-500 ml-0.5">*</span></label>
                <input type="text" value={eventSearch}
                  onChange={e => { setEventSearch(e.target.value); setNewForm(p => ({ ...p, eventId: '' })); setEventDropOpen(true) }}
                  onFocus={() => setEventDropOpen(true)}
                  onBlur={() => setTimeout(() => setEventDropOpen(false), 150)}
                  placeholder="Search event…" autoComplete="off" className={inputCls} />
                {eventDropOpen && filteredEvents.length > 0 && (
                  <div className="absolute top-full mt-1 w-full z-50 bg-white rounded-xl border border-gray-200 shadow-lg max-h-44 overflow-y-auto">
                    {filteredEvents.map(ev => (
                      <button key={ev.id} type="button" onMouseDown={() => {
                        setNewForm(p => ({ ...p, eventId: ev.id }))
                        setEventSearch(`${ev.eventName} (${ev.eventCode})`)
                        setEventDropOpen(false)
                      }} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm text-gray-800 border-b border-gray-50 last:border-0">
                        <span className="font-medium">{ev.eventName}</span>
                        <span className="text-gray-400 ml-1 text-xs">· {ev.eventCode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Category<span className="text-red-500 ml-0.5">*</span></label>
                <select title="Category" value={newForm.category}
                  onChange={e => setNewForm(p => ({ ...p, category: e.target.value }))}
                  className={inputCls}>
                  <option value="">Select category…</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Amount (USD)<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={newForm.amountUsd}
                    onChange={e => setNewForm(p => ({ ...p, amountUsd: e.target.value }))}
                    placeholder="0.00" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Date</label>
                  <input type="date" title="Transaction date" value={newForm.transactionDate}
                    onChange={e => setNewForm(p => ({ ...p, transactionDate: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Description<span className="text-red-500 ml-0.5">*</span></label>
                <input type="text" value={newForm.description}
                  onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="E.g. Return flight to Stockholm" className={inputCls} />
              </div>

              {/* Reason */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Reason<span className="text-red-500 ml-0.5">*</span></label>
                <input type="text" value={newForm.reason}
                  onChange={e => setNewForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="E.g. Business travel, client meeting" className={inputCls} />
              </div>

              {/* Merchant */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Merchant / Vendor</label>
                <input type="text" value={newForm.merchantName}
                  onChange={e => setNewForm(p => ({ ...p, merchantName: e.target.value }))}
                  placeholder="E.g. SAS, Scandic Hotel" className={inputCls} />
              </div>

              {/* Person */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Name of person (who it was for)</label>
                <input type="text" value={newForm.personName}
                  onChange={e => setNewForm(p => ({ ...p, personName: e.target.value }))}
                  placeholder="E.g. Jane Doe (leave blank if same as employee)" className={inputCls} />
              </div>

              {/* Receipt */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Receipt<span className="text-red-500 ml-0.5">*</span></label>
                <FileUpload
                  label="Drag & drop or click to upload"
                  hint="JPG, PNG, PDF, WebP — max 10 MB"
                  file={pendingFile}
                  onFile={setPendingFile}
                  onClear={() => setPendingFile(null)}
                />
              </div>

              {newError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{newError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewExpense(false)}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={newSubmitting}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
                  {newSubmitting ? 'Saving…' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
