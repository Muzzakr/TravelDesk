'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Pagination } from '@/components/ui/Pagination'
import { ExpenseApproveActions } from '@/components/manager/ExpenseApproveActions'
import { FileUpload } from '@/components/ui/FileUpload'
import { compressImageFile } from '@/lib/compress'
import { Check } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ─── Same 2-level category system as employee/expenses ─────────────────────

type ExpenseSubKey =
  | 'FLIGHT' | 'TAXI' | 'CAR_RENTAL' | 'TRAIN' | 'BUS' | 'PARKING' | 'FUEL'
  | 'HOTEL' | 'APARTMENT' | 'AIRBNB' | 'OTHER_LODGING'
  | 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACKS' | 'CLIENT_MEALS'
  | 'OTHER'

const MAIN_CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'TRANSPORT',     label: 'Transport',     emoji: '✈️' },
  { key: 'ACCOMMODATION', label: 'Accommodation', emoji: '🏨' },
  { key: 'FOOD_MEALS',    label: 'Food & Meals',  emoji: '🍽️' },
  { key: 'OTHER',         label: 'Other',         emoji: '📎' },
]

const SUB_CATEGORIES: Record<string, { key: ExpenseSubKey; label: string; emoji: string }[]> = {
  TRANSPORT: [
    { key: 'FLIGHT',     label: 'Flight',     emoji: '✈️' },
    { key: 'TAXI',       label: 'Taxi',       emoji: '🚕' },
    { key: 'CAR_RENTAL', label: 'Car Rental', emoji: '🚗' },
    { key: 'TRAIN',      label: 'Train',      emoji: '🚂' },
    { key: 'BUS',        label: 'Bus',        emoji: '🚌' },
    { key: 'PARKING',    label: 'Parking',    emoji: '🅿️' },
    { key: 'FUEL',       label: 'Fuel',       emoji: '⛽' },
  ],
  ACCOMMODATION: [
    { key: 'HOTEL',         label: 'Hotel',         emoji: '🏨' },
    { key: 'APARTMENT',     label: 'Apartment',     emoji: '🏢' },
    { key: 'AIRBNB',        label: 'Airbnb',        emoji: '🏠' },
    { key: 'OTHER_LODGING', label: 'Other Lodging', emoji: '🛏️' },
  ],
  FOOD_MEALS: [
    { key: 'BREAKFAST',    label: 'Breakfast',    emoji: '☕' },
    { key: 'LUNCH',        label: 'Lunch',        emoji: '🥙' },
    { key: 'DINNER',       label: 'Dinner',       emoji: '🍽️' },
    { key: 'SNACKS',       label: 'Snacks',       emoji: '🍿' },
    { key: 'CLIENT_MEALS', label: 'Client Meals', emoji: '🤝' },
  ],
}

const SUB_CATEGORY_MAP: Record<string, { category: string; service: string }> = {
  FLIGHT:        { category: 'TRANSPORT',     service: 'Flight' },
  TAXI:          { category: 'TRANSPORT',     service: 'Taxi' },
  CAR_RENTAL:    { category: 'TRANSPORT',     service: 'Car Rental' },
  TRAIN:         { category: 'TRANSPORT',     service: 'Train' },
  BUS:           { category: 'TRANSPORT',     service: 'Bus' },
  PARKING:       { category: 'TRANSPORT',     service: 'Parking' },
  FUEL:          { category: 'TRANSPORT',     service: 'Fuel' },
  HOTEL:         { category: 'ACCOMMODATION', service: 'Hotel' },
  APARTMENT:     { category: 'ACCOMMODATION', service: 'Apartment' },
  AIRBNB:        { category: 'ACCOMMODATION', service: 'Airbnb' },
  OTHER_LODGING: { category: 'ACCOMMODATION', service: 'Other Lodging' },
  BREAKFAST:     { category: 'MEALS',         service: 'Breakfast' },
  LUNCH:         { category: 'MEALS',         service: 'Lunch' },
  DINNER:        { category: 'MEALS',         service: 'Dinner' },
  SNACKS:        { category: 'MEALS',         service: 'Snacks' },
  CLIENT_MEALS:  { category: 'MEALS',         service: 'Client Meals' },
  OTHER:         { category: 'OTHER',         service: 'Other' },
}

const SERVICE_DETAIL_CONFIG: Record<string, { merchantLabel: string; merchantPlaceholder: string; descPlaceholder: string }> = {
  FLIGHT:        { merchantLabel: 'Airline',               merchantPlaceholder: 'E.g. SAS, Norwegian',      descPlaceholder: 'E.g. Return flight to Stockholm' },
  TAXI:          { merchantLabel: 'Provider (optional)',   merchantPlaceholder: 'E.g. Uber, Bolt',          descPlaceholder: 'E.g. Airport → hotel' },
  CAR_RENTAL:    { merchantLabel: 'Rental company',        merchantPlaceholder: 'E.g. Avis, Hertz',         descPlaceholder: 'E.g. 3-day rental' },
  TRAIN:         { merchantLabel: 'Operator (optional)',   merchantPlaceholder: 'E.g. SJ, Intercity',       descPlaceholder: 'E.g. Stockholm → Gothenburg' },
  BUS:           { merchantLabel: 'Operator (optional)',   merchantPlaceholder: 'E.g. FlixBus',             descPlaceholder: 'E.g. Airport bus' },
  PARKING:       { merchantLabel: 'Location (optional)',   merchantPlaceholder: 'E.g. Airport Parking',     descPlaceholder: 'E.g. 2 days parking' },
  FUEL:          { merchantLabel: 'Station (optional)',    merchantPlaceholder: 'E.g. Shell, BP',           descPlaceholder: 'E.g. Fuel for rental car' },
  HOTEL:         { merchantLabel: 'Hotel name',            merchantPlaceholder: 'E.g. Scandic Downtown',    descPlaceholder: 'E.g. 2 nights, conference rate' },
  APARTMENT:     { merchantLabel: 'Property name',         merchantPlaceholder: 'E.g. City Centre Flat',    descPlaceholder: 'E.g. 3-night stay' },
  AIRBNB:        { merchantLabel: 'Host / Property',       merchantPlaceholder: 'E.g. Studio in Milan',     descPlaceholder: 'E.g. 2-night Airbnb stay' },
  OTHER_LODGING: { merchantLabel: 'Location (optional)',   merchantPlaceholder: 'E.g. Hostel name',         descPlaceholder: 'E.g. Overnight accommodation' },
  BREAKFAST:     { merchantLabel: 'Vendor (optional)',     merchantPlaceholder: 'E.g. Hotel, Café',         descPlaceholder: 'E.g. Breakfast on travel day' },
  LUNCH:         { merchantLabel: 'Restaurant (optional)', merchantPlaceholder: 'E.g. The Local Bistro',    descPlaceholder: 'E.g. Working lunch' },
  DINNER:        { merchantLabel: 'Restaurant (optional)', merchantPlaceholder: 'E.g. Restaurant name',     descPlaceholder: 'E.g. Team dinner' },
  SNACKS:        { merchantLabel: 'Vendor (optional)',     merchantPlaceholder: 'E.g. Convenience store',   descPlaceholder: 'E.g. Snacks during travel' },
  CLIENT_MEALS:  { merchantLabel: 'Restaurant',            merchantPlaceholder: 'E.g. Restaurant name',     descPlaceholder: 'E.g. Lunch with client' },
  OTHER:         { merchantLabel: 'Vendor (optional)',     merchantPlaceholder: 'E.g. Office Depot',        descPlaceholder: 'E.g. USB-C hub for laptop' },
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
  employeeId: '', eventId: '', amountUsd: '', currency: 'USD',
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

  // New expense modal — same step-by-step wizard as employee/expenses
  const [showNewExpense, setShowNewExpense] = useState(false)
  const [newForm, setNewForm] = useState(EMPTY_FORM)
  const [newError, setNewError] = useState('')
  const [newSubmitting, setNewSubmitting] = useState(false)
  const [newSuccess, setNewSuccess] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [events, setEvents] = useState<TravelEvent[]>([])
  const [eventSearch, setEventSearch] = useState('')
  const [eventDropOpen, setEventDropOpen] = useState(false)
  const [mainCategory, setMainCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [newStep, setNewStep] = useState(1)
  const [vehicleType, setVehicleType] = useState('')

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
    setMainCategory('')
    setSubCategory('')
    setVehicleType('')
    setNewStep(1)
    if (events.length === 0) {
      fetch('/api/events').then(r => r.json()).then((d: TravelEvent[]) =>
        setEvents(d.filter(e => (e as unknown as { status: string }).status !== 'CLOSED'))
      )
    }
    setShowNewExpense(true)
  }

  function closeNewExpense() {
    setShowNewExpense(false)
    setNewStep(1)
    setMainCategory('')
    setSubCategory('')
    setVehicleType('')
    setNewError('')
    setEventSearch('')
    setNewForm(EMPTY_FORM)
    setPendingFile(null)
  }

  function selectSubCat(key: string) {
    setSubCategory(key)
    setNewError('')
    setNewStep(3)
  }

  function newExpNext() {
    if (newStep === 1 && (!newForm.employeeId || !newForm.eventId)) { setNewError('Please select an employee and an event.'); return }
    if (newStep === 3) {
      if (!newForm.amountUsd || Number(newForm.amountUsd) <= 0) { setNewError('Please enter a valid amount.'); return }
      if (!newForm.description.trim()) { setNewError('Please enter a description.'); return }
      if (!newForm.reason.trim()) { setNewError('Please enter a reason for this expense.'); return }
    }
    setNewError('')
    setNewStep(s => s + 1)
  }

  async function submitNewExpense() {
    if (!pendingFile) { setNewError('A receipt is required — please attach a receipt before submitting.'); return }
    setNewSubmitting(true)
    setNewError('')

    const mapped = SUB_CATEGORY_MAP[subCategory] ?? { category: 'OTHER', service: 'Other' }
    const finalDescription = subCategory === 'CAR_RENTAL' && vehicleType
      ? `Vehicle: ${vehicleType}${newForm.description ? '. ' + newForm.description : ''}`
      : newForm.description

    const compressPromise = pendingFile ? compressImageFile(pendingFile) : Promise.resolve(null)

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newForm,
        description: finalDescription,
        category: mapped.category,
        service: mapped.service,
        amountUsd: Number(newForm.amountUsd),
      }),
    })
    const resData = await res.json()
    if (!res.ok) {
      setNewError(typeof resData.error === 'string' ? resData.error : JSON.stringify(resData.error))
      setNewSubmitting(false)
      return
    }
    if (pendingFile && resData.expense?.id) {
      const compressed = await compressPromise
      const fd = new FormData()
      fd.append('file', compressed as File)
      fd.append('expenseId', resData.expense.id)
      await fetch('/api/receipts/upload', { method: 'POST', body: fd })
    }
    setNewSubmitting(false)
    closeNewExpense()
    setNewSuccess('Expense created successfully.')
    setTimeout(() => setNewSuccess(''), 4000)
    fetchData()
  }

  const filteredEvents = events.filter(ev =>
    !eventSearch ||
    ev.eventName.toLowerCase().includes(eventSearch.toLowerCase()) ||
    (ev.eventCode ?? '').toLowerCase().includes(eventSearch.toLowerCase())
  )

  const subCatInfo = subCategory ? (SUB_CATEGORIES[mainCategory] ?? []).find(s => s.key === subCategory) : null
  const mainCatInfo = mainCategory ? MAIN_CATEGORIES.find(m => m.key === mainCategory) : null
  const currentEmoji = subCatInfo?.emoji ?? mainCatInfo?.emoji ?? '📎'
  const currentLabel = subCatInfo?.label ?? ''
  const svcCfg = subCategory ? SERVICE_DETAIL_CONFIG[subCategory] : null
  const selectedEvent = events.find(ev => ev.id === newForm.eventId)
  const selectedEmployee = data?.employees.find(emp => emp.id === newForm.employeeId)

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

      {/* ── New Expense Modal — same step-by-step wizard as employee/expenses ── */}
      {showNewExpense && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeNewExpense} />
          <div className="relative w-full sm:max-w-xl max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">New Expense</h2>
              <button type="button" aria-label="Close" onClick={closeNewExpense} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pt-5">
              {/* Progress bar */}
              <div className="flex items-center mb-6">
                {(['Employee', 'Type', 'Details', 'Review'] as const).map((label, i) => {
                  const n = i + 1; const done = newStep > n; const active = newStep === n
                  return (
                    <div key={label} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-indigo-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                          {done ? <Check className="w-4 h-4" /> : n}
                        </div>
                        <span className={`mt-1 text-xs font-medium hidden sm:block ${active ? 'text-indigo-600' : done ? 'text-indigo-400' : 'text-gray-400'}`}>{label}</span>
                      </div>
                      {i < 3 && <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${newStep > n ? 'bg-indigo-400' : 'bg-gray-200'}`} />}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="px-5 pb-5 space-y-6">

              {/* ─── Step 1: Employee + Event ──────────────────────────── */}
              {newStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Who & which event</h2>
                    <p className="text-sm text-gray-500">Select the employee and event this expense is for.</p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Employee<span className="text-red-500 ml-0.5">*</span></label>
                    <select title="Employee" value={newForm.employeeId}
                      onChange={e => setNewForm(p => ({ ...p, employeeId: e.target.value }))}
                      className={inputCls}>
                      <option value="">Select employee…</option>
                      {data?.employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </div>

                  <div className="relative flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Event<span className="text-red-500 ml-0.5">*</span></label>
                    <input
                      type="text" value={eventSearch}
                      onChange={e => { setEventSearch(e.target.value); setNewForm(p => ({ ...p, eventId: '' })); setEventDropOpen(true) }}
                      onFocus={() => setEventDropOpen(true)}
                      onBlur={() => setTimeout(() => setEventDropOpen(false), 150)}
                      placeholder="Search events…" autoComplete="off" className={inputCls}
                    />
                    {eventDropOpen && filteredEvents.length > 0 && (
                      <div className="absolute top-full mt-1 w-full z-50 bg-white rounded-xl border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
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
                </div>
              )}

              {/* ─── Step 2: Expense Type (2-level) ─────────────── */}
              {newStep === 2 && (
                <div>
                  {!mainCategory ? (
                    <>
                      <h2 className="text-lg font-semibold text-gray-900 mb-1">Type of expense</h2>
                      <p className="text-sm text-gray-500 mb-5">Select the main category.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {MAIN_CATEGORIES.map(({ key, label, emoji }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              if (key === 'OTHER') {
                                setMainCategory('OTHER'); setSubCategory('OTHER'); setNewError(''); setNewStep(3)
                              } else {
                                setMainCategory(key)
                              }
                            }}
                            className="rounded-2xl border-2 border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 p-6 flex flex-col items-center gap-3 transition-all group"
                          >
                            <span className="text-4xl group-hover:scale-110 transition-transform select-none">{emoji}</span>
                            <span className="text-sm font-semibold text-gray-800">{label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-5">
                        <button
                          type="button"
                          onClick={() => { setMainCategory(''); setSubCategory('') }}
                          className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          ← Change
                        </button>
                        <span className="text-gray-200">/</span>
                        {(() => { const mc = MAIN_CATEGORIES.find(m => m.key === mainCategory); return mc ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-base select-none">{mc.emoji}</span>
                            <span className="text-sm font-semibold text-gray-700">{mc.label}</span>
                          </div>
                        ) : null })()}
                      </div>
                      <h2 className="text-base font-semibold text-gray-900 mb-1">Select type</h2>
                      <p className="text-sm text-gray-500 mb-4">Choose the specific expense type.</p>
                      <div className={`grid gap-3 ${(SUB_CATEGORIES[mainCategory]?.length ?? 0) > 4 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2'}`}>
                        {(SUB_CATEGORIES[mainCategory] ?? []).map(({ key, label, emoji }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => selectSubCat(key)}
                            className="rounded-2xl border-2 border-gray-200 bg-white hover:border-indigo-500 hover:bg-indigo-600 hover:text-white p-4 flex flex-col items-center gap-2 transition-all group"
                          >
                            <span className="text-3xl select-none group-hover:scale-110 transition-transform">{emoji}</span>
                            <span className="text-xs font-semibold text-gray-700 group-hover:text-white transition-colors text-center leading-tight">{label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ─── Step 3: Details ─────────────────────────────── */}
              {newStep === 3 && svcCfg && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl bg-indigo-50 border-l-4 border-indigo-600 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl select-none">{currentEmoji}</span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-400">{mainCatInfo?.label}</p>
                        <p className="font-semibold text-indigo-900 leading-tight">{currentLabel}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setNewStep(2); setSubCategory('') }} className="text-xs text-indigo-500 hover:underline">Change</button>
                  </div>

                  {subCategory === 'CAR_RENTAL' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Type of vehicle</label>
                      <select title="Type of vehicle" value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={inputCls}>
                        <option value="">Select type…</option>
                        <option value="Economy">Economy</option>
                        <option value="Compact">Compact</option>
                        <option value="SUV">SUV</option>
                        <option value="Van">Van</option>
                        <option value="Minibus">Minibus</option>
                        <option value="Luxury">Luxury</option>
                      </select>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">{svcCfg.merchantLabel}</label>
                    <input type="text" value={newForm.merchantName}
                      onChange={e => setNewForm(p => ({ ...p, merchantName: e.target.value }))}
                      placeholder={svcCfg.merchantPlaceholder} className={inputCls} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Amount (USD)<span className="text-red-500 ml-0.5">*</span></label>
                      <input type="number" inputMode="decimal" step="0.01" min="0" value={newForm.amountUsd}
                        onChange={e => setNewForm(p => ({ ...p, amountUsd: e.target.value }))}
                        placeholder="45.00" className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Date</label>
                      <input type="date" title="Transaction date" value={newForm.transactionDate}
                        onChange={e => setNewForm(p => ({ ...p, transactionDate: e.target.value }))}
                        className={inputCls} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Description<span className="text-red-500 ml-0.5">*</span></label>
                    <input type="text" value={newForm.description}
                      onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
                      placeholder={svcCfg.descPlaceholder} className={inputCls} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Reason for expense<span className="text-red-500 ml-0.5">*</span></label>
                    <input type="text" value={newForm.reason}
                      onChange={e => setNewForm(p => ({ ...p, reason: e.target.value }))}
                      placeholder="E.g. Client meeting, business travel" className={inputCls} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Name of person (who it was for)</label>
                    <input type="text" value={newForm.personName}
                      onChange={e => setNewForm(p => ({ ...p, personName: e.target.value }))}
                      placeholder={`E.g. ${selectedEmployee?.name ?? 'Jane Doe'} (leave blank if same as employee)`} className={inputCls} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-gray-700">Receipt<span className="text-red-500 ml-0.5">*</span></p>
                    <FileUpload
                      label="Drag & drop or click to upload"
                      hint="JPG, PNG, PDF, WebP — max 10 MB"
                      file={pendingFile}
                      onFile={setPendingFile}
                      onClear={() => setPendingFile(null)}
                    />
                  </div>
                </div>
              )}

              {/* ─── Step 4: Review ──────────────────────────────── */}
              {newStep === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Review the expense</h2>
                    <p className="text-sm text-gray-500">Double-check everything before submitting.</p>
                  </div>

                  {selectedEmployee && (
                    <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Employee</p>
                      <p className="font-semibold text-gray-900">{selectedEmployee.name}</p>
                    </div>
                  )}

                  {selectedEvent && (
                    <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-4">
                      <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Event</p>
                      <p className="font-semibold text-gray-900">{selectedEvent.eventName}</p>
                      {selectedEvent.eventCode && <p className="text-sm text-gray-500">{selectedEvent.eventCode}</p>}
                    </div>
                  )}

                  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xl select-none">{currentEmoji}</span>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">{mainCatInfo?.label}</p>
                          <p className="text-sm font-semibold text-gray-800 leading-tight">{currentLabel}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setNewStep(3)} className="text-xs text-indigo-600 font-medium hover:underline">Edit</button>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Amount</span><span className="text-gray-900 font-medium">${Number(newForm.amountUsd || 0).toFixed(2)}</span></div>
                      {newForm.transactionDate && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Date</span><span className="text-gray-900 font-medium">{new Date(newForm.transactionDate + 'T12:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span></div>}
                      {newForm.merchantName && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Merchant</span><span className="text-gray-900 font-medium">{newForm.merchantName}</span></div>}
                      {vehicleType && subCategory === 'CAR_RENTAL' && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Vehicle type</span><span className="text-gray-900 font-medium">{vehicleType}</span></div>}
                      {newForm.description && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Description</span><span className="text-gray-900 font-medium">{newForm.description}</span></div>}
                      {newForm.reason && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Reason</span><span className="text-gray-900 font-medium">{newForm.reason}</span></div>}
                      {newForm.personName && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Expense for</span><span className="text-gray-900 font-medium">{newForm.personName}</span></div>}
                      <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Receipt</span><span className="text-gray-900 font-medium">{pendingFile ? pendingFile.name : <span className="text-amber-600">None — required</span>}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {newError && (
                <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{newError}</p>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-1 justify-between">
                {newStep > 1 ? (
                  <button type="button"
                    onClick={() => {
                      setNewError('')
                      if (newStep === 2 && mainCategory) { setMainCategory(''); setSubCategory('') }
                      else setNewStep(s => s - 1)
                    }}
                    className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    ← Back
                  </button>
                ) : (
                  <button type="button" onClick={closeNewExpense}
                    className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                )}
                {newStep !== 2 && (
                  newStep < 4 ? (
                    <button type="button" onClick={newExpNext}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors">
                      Next →
                    </button>
                  ) : (
                    <button type="button" onClick={submitNewExpense} disabled={newSubmitting}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold transition-colors">
                      {newSubmitting ? 'Saving…' : 'Save expense'}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
