'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { FileUpload } from '@/components/ui/FileUpload'
import Link from 'next/link'
import { DateInput } from '@/components/ui/DateInput'
import type { TravelEvent } from '@/types/event'
import type { Expense } from '@/types/expense'
import { PaperAirplaneIcon, BuildingOfficeIcon, TruckIcon, ShoppingBagIcon, MapPinIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import { Check, AlertTriangle } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>

// ─── Constants ────────────────────────────────────────────────────────────────

const inputCls = 'rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white'

const EXPENSE_TYPES: { key: string; Icon: HeroIcon; label: string }[] = [
  { key: 'FLIGHT',     Icon: PaperAirplaneIcon,  label: 'Flight' },
  { key: 'HOTEL',      Icon: BuildingOfficeIcon, label: 'Hotel' },
  { key: 'CAR_RENTAL', Icon: TruckIcon,          label: 'Car Rental' },
  { key: 'FOOD',       Icon: ShoppingBagIcon,    label: 'Food' },
  { key: 'TAXI',       Icon: MapPinIcon,         label: 'Taxi' },
  { key: 'OTHER',      Icon: PlusCircleIcon,     label: 'Other' },
]

const EXPENSE_TYPE_MAP: Record<string, { category: string; service: string }> = {
  FLIGHT:     { category: 'TRANSPORT',     service: 'Flights' },
  HOTEL:      { category: 'ACCOMMODATION', service: 'Hotel' },
  CAR_RENTAL: { category: 'TRANSPORT',     service: 'Car Rental' },
  FOOD:       { category: 'MEALS',         service: 'Food' },
  TAXI:       { category: 'TRANSPORT',     service: 'Taxi' },
  OTHER:      { category: 'OTHER',         service: 'Other' },
}

const SERVICE_DETAIL_CONFIG: Record<string, { merchantLabel: string; merchantPlaceholder: string; descPlaceholder: string }> = {
  FLIGHT:     { merchantLabel: 'Airline',             merchantPlaceholder: 'E.g. SAS, Norwegian',    descPlaceholder: 'E.g. Return flight to Stockholm' },
  HOTEL:      { merchantLabel: 'Hotel name',          merchantPlaceholder: 'E.g. Scandic Downtown',  descPlaceholder: 'E.g. 2 nights, conference rate' },
  CAR_RENTAL: { merchantLabel: 'Rental company',      merchantPlaceholder: 'E.g. Avis, Hertz',       descPlaceholder: 'E.g. 3-day rental' },
  FOOD:       { merchantLabel: 'Restaurant / Vendor', merchantPlaceholder: 'E.g. The Local Bistro',  descPlaceholder: 'E.g. Team lunch' },
  TAXI:       { merchantLabel: 'Provider (optional)', merchantPlaceholder: 'E.g. Uber, Bolt',        descPlaceholder: 'E.g. Airport → hotel' },
  OTHER:      { merchantLabel: 'Vendor (optional)',   merchantPlaceholder: 'E.g. Office Depot',      descPlaceholder: 'E.g. USB-C hub for laptop' },
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const EXPENSE_DRAFT_KEY = 'expense_draft'

// ─── Main content ─────────────────────────────────────────────────────────────

function ExpensesContent() {
  const params = useSearchParams()
  const isAdminView = params.get('view') === 'admin'
  const [expenses, setExpenses]     = useState<Expense[]>([])
  const [events, setEvents]         = useState<TravelEvent[]>([])
  const [showForm, setShowForm]     = useState(params.get('add') === '1')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [manager, setManager]       = useState<{ name: string; email: string } | null | undefined>(undefined)
  const [addingReceiptFor, setAddingReceiptFor]       = useState<string | null>(null)
  const [uploadingReceiptFor, setUploadingReceiptFor] = useState<string | null>(null)
  const [receiptUploadError, setReceiptUploadError]   = useState('')
  const [notice, setNotice]                           = useState('')

  // Expense type card selection
  const [expenseType, setExpenseType] = useState('')
  const [step, setStep]               = useState(1)
  const [vehicleType, setVehicleType] = useState('')

  // Inline event combobox state
  const [eventSearch, setEventSearch]     = useState('')
  const [eventDropOpen, setEventDropOpen] = useState(false)

  const [form, setForm] = useState({
    eventId: '', amountUsd: '', currency: 'USD',
    description: '', merchantName: '', transactionDate: '',
    reason: '', personName: '',
  })

  useEffect(() => {
    fetch('/api/expenses').then(r => r.json()).then(setExpenses)
    fetch('/api/events').then(r => r.json()).then(data => setEvents(data.filter((e: TravelEvent) => e.status !== 'CLOSED')))
    fetch('/api/users/me').then(r => r.json()).then(data => setManager(data.manager ?? null))
  }, [])

  // Restore expense draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPENSE_DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.form)        setForm(d.form)
      if (d.expenseType) setExpenseType(d.expenseType)
      if (d.vehicleType) setVehicleType(d.vehicleType)
      if (d.step)        setStep(d.step)
      if (d.eventSearch) setEventSearch(d.eventSearch)
      if (d.form?.eventId) setShowForm(true)
    } catch { /* ignore */ }
  }, [])

  // Save expense draft on every change
  useEffect(() => {
    if (!showForm) return
    try {
      localStorage.setItem(EXPENSE_DRAFT_KEY, JSON.stringify({ form, expenseType, vehicleType, step, eventSearch }))
    } catch { /* ignore */ }
  }, [form, expenseType, vehicleType, step, eventSearch, showForm])

  // Filtered events for the combobox
  const filteredEvents = events.filter(ev =>
    !eventSearch ||
    ev.eventName.toLowerCase().includes(eventSearch.toLowerCase()) ||
    (ev.eventCode ?? '').toLowerCase().includes(eventSearch.toLowerCase())
  )

  function selectEvent(ev: TravelEvent) {
    setForm(p => ({ ...p, eventId: ev.id }))
    setEventSearch(`${ev.eventName} (${ev.eventCode})`)
    setEventDropOpen(false)
  }

  function closeForm() {
    localStorage.removeItem(EXPENSE_DRAFT_KEY)
    setShowForm(false)
    setStep(1)
    setExpenseType('')
    setVehicleType('')
    setError('')
    setEventSearch('')
    setForm({ eventId: '', amountUsd: '', currency: 'USD', description: '', merchantName: '', transactionDate: '', reason: '', personName: '' })
    setPendingFile(null)
  }

  function expNext() {
    if (step === 1 && !form.eventId)          { setError('Please select an event.'); return }
    if (step === 2 && !expenseType)            { setError('Please select an expense type.'); return }
    if (step === 3) {
      if (!form.amountUsd || Number(form.amountUsd) <= 0) { setError('Please enter a valid amount.'); return }
      if (!form.description.trim())            { setError('Please enter a description.'); return }
      if (!form.reason.trim())                 { setError('Please enter a reason for this expense.'); return }
    }
    setError('')
    setStep(s => s + 1)
  }

  async function handleSubmit() {
    if (!pendingFile) { setError('A receipt is required — please attach a receipt before submitting.'); return }
    setLoading(true)
    setError('')
    setNotice('')

    const mapped = EXPENSE_TYPE_MAP[expenseType] ?? { category: 'OTHER', service: 'Other' }
    const finalDescription = expenseType === 'CAR_RENTAL' && vehicleType
      ? `Vehicle: ${vehicleType}${form.description ? '. ' + form.description : ''}`
      : form.description

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        description: finalDescription,
        category: mapped.category,
        service: mapped.service,
        amountUsd: Number(form.amountUsd),
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
      setLoading(false)
      return
    }

    let receiptError = ''
    if (pendingFile && data.expense) {
      const fd = new FormData()
      fd.append('file', pendingFile)
      fd.append('expenseId', data.expense.id)
      const uploadRes = await fetch('/api/receipts/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) {
        let msg = `HTTP ${uploadRes.status}`
        try { const d = await uploadRes.json(); if (d?.error) msg = d.error } catch {}
        receiptError = `Your expense was saved, but the receipt could not be uploaded (${msg}). Click "Add receipt" on the expense row below to attach it.`
      }
    }

    const refreshed = await fetch('/api/expenses', { cache: 'no-store' }).then(r => r.json())
    setExpenses(refreshed)
    localStorage.removeItem(EXPENSE_DRAFT_KEY)
    setShowForm(false)
    setStep(1)
    setExpenseType('')
    setVehicleType('')
    setEventSearch('')
    setForm({ eventId: '', amountUsd: '', currency: 'USD', description: '', merchantName: '', transactionDate: '', reason: '', personName: '' })
    setPendingFile(null)
    setLoading(false)
    if (receiptError) setNotice(receiptError)
  }

  const canAddReceipt = (status: string) => !['PAID', 'REJECTED', 'APPROVED'].includes(status)

  async function handleQuickReceiptUpload(expenseId: string, file: File) {
    setUploadingReceiptFor(expenseId)
    setReceiptUploadError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('expenseId', expenseId)
    const res = await fetch('/api/receipts/upload', { method: 'POST', body: fd })
    if (!res.ok) {
      let msg = `Upload failed (${res.status})`
      try { const d = await res.json(); msg = d.error ?? msg } catch {}
      setReceiptUploadError(msg)
    } else {
      setAddingReceiptFor(null)
      setReceiptUploadError('')
      const refreshed = await fetch('/api/expenses').then(r => r.json())
      setExpenses(refreshed)
    }
    setUploadingReceiptFor(null)
  }

  async function submitExpense(expenseId: string) {
    setSubmittingId(expenseId)
    await fetch(`/api/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SUBMITTED' }),
    })
    const refreshed = await fetch('/api/expenses').then(r => r.json())
    setExpenses(refreshed)
    setSubmittingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setStep(1); setExpenseType(''); setVehicleType(''); setError('') }}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            + Add expense
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss" title="Dismiss"
            className="shrink-0 text-amber-500 hover:text-amber-700 font-medium">×</button>
        </div>
      )}

      {showForm && (() => {
        const currentTypeConfig = expenseType ? EXPENSE_TYPES.find(t => t.key === expenseType) : null
        const CurrentIcon  = currentTypeConfig?.Icon ?? PlusCircleIcon
        const currentLabel = currentTypeConfig?.label ?? ''
        const cfg          = expenseType ? SERVICE_DETAIL_CONFIG[expenseType] : null
        const selectedEvent = events.find(e => e.id === form.eventId)
        return (
          <div className="mx-auto max-w-2xl">
            {/* Progress bar */}
            <div className="flex items-center mb-6">
              {(['Event', 'Type', 'Details', 'Review'] as const).map((label, i) => {
                const n = i + 1; const done = step > n; const active = step === n
                return (
                  <div key={label} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-indigo-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        {done ? <Check className="w-4 h-4" /> : n}
                      </div>
                      <span className={`mt-1 text-xs font-medium hidden sm:block ${active ? 'text-indigo-600' : done ? 'text-indigo-400' : 'text-gray-400'}`}>{label}</span>
                    </div>
                    {i < 3 && <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${step > n ? 'bg-indigo-400' : 'bg-gray-200'}`} />}
                  </div>
                )
              })}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">

              {/* ─── Step 1: Event ──────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Select event</h2>
                    <p className="text-sm text-gray-500">Choose the event this expense is for.</p>
                  </div>

                  {manager && (
                    <div className="rounded-xl bg-indigo-50 px-4 py-3 text-sm">
                      <span className="text-indigo-800"><span className="font-medium">Will be approved by:</span> {manager.name} ({manager.email})</span>
                    </div>
                  )}

                  <div className="relative flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Event<span className="text-red-500 ml-0.5">*</span></label>
                    <input
                      type="text" value={eventSearch}
                      onChange={e => { setEventSearch(e.target.value); setForm(p => ({ ...p, eventId: '' })); setEventDropOpen(true) }}
                      onFocus={() => setEventDropOpen(true)}
                      onBlur={() => setTimeout(() => setEventDropOpen(false), 150)}
                      placeholder="Search events…" autoComplete="off" className={inputCls}
                    />
                    {eventDropOpen && filteredEvents.length > 0 && (
                      <div className="absolute top-full mt-1 w-full z-50 bg-white rounded-xl border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
                        {filteredEvents.map(ev => (
                          <button key={ev.id} type="button" onMouseDown={() => selectEvent(ev)}
                            className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm text-gray-800 border-b border-gray-50 last:border-0">
                            <span className="font-medium">{ev.eventName}</span>
                            <span className="text-gray-400 ml-1 text-xs">· {ev.eventCode}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Step 2: Expense Type ────────────────────────── */}
              {step === 2 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Type of expense</h2>
                  <p className="text-sm text-gray-500 mb-5">Select the service you want to expense.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {EXPENSE_TYPES.map(({ key, Icon, label }) => {
                      const sel = expenseType === key
                      return (
                        <button key={key} type="button" onClick={() => setExpenseType(key)}
                          className={`rounded-2xl border-2 p-5 flex flex-col items-center gap-2 transition-all ${sel ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white hover:border-indigo-300 text-gray-700'}`}>
                          <Icon className="w-8 h-8" />
                          <span className="text-sm font-semibold">{label}</span>
                          {sel && (
                            <div className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ─── Step 3: Details ─────────────────────────────── */}
              {step === 3 && cfg && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl bg-indigo-50 border-l-4 border-indigo-600 px-4 py-3">
                    <CurrentIcon className="w-6 h-6 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-indigo-900">{currentLabel}</span>
                  </div>

                  {expenseType === 'CAR_RENTAL' && (
                    <Field label="Type of vehicle">
                      <select title="Type of vehicle" value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={inputCls}>
                        <option value="">Select type…</option>
                        <option value="Economy">Economy</option>
                        <option value="Compact">Compact</option>
                        <option value="SUV">SUV</option>
                        <option value="Van">Van</option>
                        <option value="Minibus">Minibus</option>
                        <option value="Luxury">Luxury</option>
                      </select>
                    </Field>
                  )}

                  <Field label={cfg.merchantLabel}>
                    <input type="text" value={form.merchantName}
                      onChange={e => setForm(p => ({ ...p, merchantName: e.target.value }))}
                      placeholder={cfg.merchantPlaceholder} className={inputCls} />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Amount (USD)" required>
                      <input type="number" step="0.01" min="0" value={form.amountUsd}
                        onChange={e => setForm(p => ({ ...p, amountUsd: e.target.value }))}
                        placeholder="45.00" className={inputCls} />
                    </Field>
                    <Field label="Date">
                      <DateInput title="Date" value={form.transactionDate}
                        onChange={v => setForm(p => ({ ...p, transactionDate: v }))} className={inputCls} />
                    </Field>
                  </div>

                  <Field label="Description" required>
                    <input type="text" value={form.description}
                      onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder={cfg.descPlaceholder} className={inputCls} />
                  </Field>

                  <Field label="Reason for expense" required>
                    <input type="text" value={form.reason}
                      onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                      placeholder="E.g. Client meeting, business travel" className={inputCls} />
                  </Field>

                  <Field label="Name of person (who it was for)">
                    <input type="text" value={form.personName}
                      onChange={e => setForm(p => ({ ...p, personName: e.target.value }))}
                      placeholder="E.g. Jane Doe (leave blank if for yourself)" className={inputCls} />
                  </Field>

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
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Review your expense</h2>
                    <p className="text-sm text-gray-500">Double-check everything before submitting.</p>
                  </div>

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
                        <CurrentIcon className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-800">{currentLabel}</span>
                      </div>
                      <button type="button" onClick={() => setStep(3)} className="text-xs text-indigo-600 font-medium hover:underline">Edit</button>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Amount</span><span className="text-gray-900 font-medium">${Number(form.amountUsd || 0).toFixed(2)}</span></div>
                      {form.transactionDate && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Date</span><span className="text-gray-900 font-medium">{new Date(form.transactionDate + 'T12:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span></div>}
                      {form.merchantName && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Merchant</span><span className="text-gray-900 font-medium">{form.merchantName}</span></div>}
                      {vehicleType && expenseType === 'CAR_RENTAL' && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Vehicle type</span><span className="text-gray-900 font-medium">{vehicleType}</span></div>}
                      {form.description && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Description</span><span className="text-gray-900 font-medium">{form.description}</span></div>}
                      {form.reason && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Reason</span><span className="text-gray-900 font-medium">{form.reason}</span></div>}
                      {form.personName && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Expense for</span><span className="text-gray-900 font-medium">{form.personName}</span></div>}
                      <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Receipt</span><span className="text-gray-900 font-medium">{pendingFile ? pendingFile.name : <span className="text-amber-600">None — required</span>}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</p>
              )}

              {/* Navigation */}
              <div className={`flex gap-3 pt-1 ${step > 1 ? 'justify-between' : 'justify-between'}`}>
                {step > 1 ? (
                  <button type="button" onClick={() => { setError(''); setStep(s => s - 1) }}
                    className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    ← Back
                  </button>
                ) : (
                  <button type="button" onClick={closeForm}
                    className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                )}
                {step < 4 ? (
                  <button type="button" onClick={expNext}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors">
                    Next →
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={loading}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold transition-colors">
                    {loading ? 'Saving…' : 'Save expense'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {expenses.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No expenses yet.</p>
        ) : expenses.map((exp) => (
          <div key={exp.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/employee/expenses/${exp.id}`} className="font-medium text-gray-900 hover:text-indigo-600 truncate block">{exp.description}</Link>
                <p className="text-xs text-gray-400">{exp.category}</p>
              </div>
              <Badge variant={statusToBadgeVariant(exp.status)}>{exp.status}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-800">${Number(exp.amountUsd).toFixed(2)}</span>
              <span className="text-xs text-gray-400">{exp.transactionDate ? new Date(exp.transactionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</span>
            </div>
            {exp.status === 'DRAFT' && (
              <button
                type="button"
                onClick={() => submitExpense(exp.id)}
                disabled={submittingId === exp.id}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submittingId === exp.id ? 'Submitting…' : 'Submit for approval'}
              </button>
            )}
            {canAddReceipt(exp.status) && (exp.receipts?.length ?? 0) === 0 && (
              <div className="pt-1">
                {addingReceiptFor === exp.id ? (
                  <div className="space-y-2">
                    <FileUpload
                      label={uploadingReceiptFor === exp.id ? 'Uploading…' : 'Select receipt'}
                      hint="JPG, PNG, PDF, WebP — max 10 MB"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      disabled={uploadingReceiptFor === exp.id}
                      onFile={(file) => handleQuickReceiptUpload(exp.id, file)}
                    />
                    {receiptUploadError && addingReceiptFor === exp.id && (
                      <p className="text-xs text-red-600">{receiptUploadError}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => { setAddingReceiptFor(null); setReceiptUploadError('') }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingReceiptFor(exp.id)}
                    className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> No receipt — Add receipt
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table — hidden while form is open */}
      {!showForm && <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white shadow-sm">
        {expenses.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No expenses yet.</p>
        ) : (
          <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Receipt</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((exp) => (
                <React.Fragment key={exp.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/employee/expenses/${exp.id}`} className="hover:text-indigo-600">{exp.description}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{exp.category}</td>
                    <td className="px-4 py-3 font-medium">${Number(exp.amountUsd).toFixed(2)}</td>
                    <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(exp.status)}>{exp.status}</Badge></td>
                    <td className="px-4 py-3">
                      {(exp.receipts?.length ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="w-3.5 h-3.5" /> {exp.receipts!.length}</span>
                      ) : canAddReceipt(exp.status) ? (
                        <button
                          type="button"
                          onClick={() => { setAddingReceiptFor(addingReceiptFor === exp.id ? null : exp.id); setReceiptUploadError('') }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Add receipt
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{exp.transactionDate ? new Date(exp.transactionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3 flex items-center gap-3">
                      <Link href={`/employee/expenses/${exp.id}`} className="text-xs font-medium text-indigo-600 hover:underline">
                        View →
                      </Link>
                      {exp.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => submitExpense(exp.id)}
                          disabled={submittingId === exp.id}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {submittingId === exp.id ? 'Submitting…' : 'Submit'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {addingReceiptFor === exp.id && (
                    <tr>
                      <td colSpan={7} className="px-4 pb-3 bg-amber-50">
                        <div className="max-w-sm space-y-2 pt-2">
                          <FileUpload
                            label={uploadingReceiptFor === exp.id ? 'Uploading…' : 'Select receipt file'}
                            hint="JPG, PNG, PDF, WebP — max 10 MB"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            disabled={uploadingReceiptFor === exp.id}
                            onFile={(file) => handleQuickReceiptUpload(exp.id, file)}
                          />
                          {receiptUploadError && (
                            <p className="text-xs text-red-600">{receiptUploadError}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => { setAddingReceiptFor(null); setReceiptUploadError('') }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>}
    </div>
  )
}

export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesContent />
    </Suspense>
  )
}
