'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { FileUpload } from '@/components/ui/FileUpload'
import Link from 'next/link'
import type { TravelEvent } from '@/types/event'
import type { Expense } from '@/types/expense'

// ─── Constants ────────────────────────────────────────────────────────────────

const inputCls = 'rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white'

const EXPENSE_TYPES = [
  { key: 'FLIGHT',     icon: '✈️', label: 'Flight' },
  { key: 'HOTEL',      icon: '🏨', label: 'Hotel' },
  { key: 'CAR_RENTAL', icon: '🚗', label: 'Car Rental' },
  { key: 'FOOD',       icon: '🍽️', label: 'Food' },
  { key: 'TAXI',       icon: '🚕', label: 'Taxi' },
  { key: 'OTHER',      icon: '📦', label: 'Other' },
]

const EXPENSE_TYPE_MAP: Record<string, { category: string; service: string }> = {
  FLIGHT:     { category: 'TRANSPORT',     service: 'Flights' },
  HOTEL:      { category: 'ACCOMMODATION', service: 'Hotel' },
  CAR_RENTAL: { category: 'TRANSPORT',     service: 'Car Rental' },
  FOOD:       { category: 'MEALS',         service: 'Food' },
  TAXI:       { category: 'TRANSPORT',     service: 'Taxi' },
  OTHER:      { category: 'OTHER',         service: 'Other' },
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

// ─── Main content ─────────────────────────────────────────────────────────────

function ExpensesContent() {
  const params = useSearchParams()
  const [expenses, setExpenses]     = useState<Expense[]>([])
  const [events, setEvents]         = useState<TravelEvent[]>([])
  const [showForm, setShowForm]     = useState(params.get('add') === '1')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [manager, setManager]       = useState<{ name: string; email: string } | null | undefined>(undefined)

  // Expense type card selection
  const [expenseType, setExpenseType] = useState('')

  // Inline event combobox state
  const [eventSearch, setEventSearch]     = useState('')
  const [eventDropOpen, setEventDropOpen] = useState(false)

  const [form, setForm] = useState({
    eventId: '', amountUsd: '', currency: 'USD',
    description: '', merchantName: '', transactionDate: '',
  })

  useEffect(() => {
    fetch('/api/expenses').then(r => r.json()).then(setExpenses)
    fetch('/api/events').then(r => r.json()).then(data => setEvents(data.filter((e: TravelEvent) => e.status !== 'CLOSED')))
    fetch('/api/users/me').then(r => r.json()).then(data => setManager(data.manager ?? null))
  }, [])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.eventId)  { setError('Please select an event.'); return }
    if (!expenseType)   { setError('Please select an expense type.'); return }
    if (!pendingFile)   { setError('A receipt is required — please attach a receipt before submitting.'); return }
    setLoading(true)
    setError('')

    const mapped = EXPENSE_TYPE_MAP[expenseType] ?? { category: 'OTHER', service: 'Other' }

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
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

    if (pendingFile && data.expense) {
      const fd = new FormData()
      fd.append('file', pendingFile)
      fd.append('expenseId', data.expense.id)
      await fetch('/api/receipts/upload', { method: 'POST', body: fd })
    }

    const refreshed = await fetch('/api/expenses').then(r => r.json())
    setExpenses(refreshed)
    setShowForm(false)
    setExpenseType('')
    setEventSearch('')
    setForm({ eventId: '', amountUsd: '', currency: 'USD', description: '', merchantName: '', transactionDate: '' })
    setPendingFile(null)
    setLoading(false)
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
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          + Add expense
        </button>
      </div>

      {showForm && (
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">New expense</h2>

            {/* Approver info */}
            <div className="rounded-xl bg-indigo-50 px-4 py-3 text-sm">
              {manager === undefined && <span className="text-gray-400">Loading approver…</span>}
              {manager === null && (
                <span className="text-amber-700 font-medium">⚠ No manager assigned — contact your admin to set an approver.</span>
              )}
              {manager && (
                <span className="text-indigo-800">
                  <span className="font-medium">Will be approved by:</span> {manager.name} ({manager.email})
                </span>
              )}
            </div>

            {/* Event — searchable combobox */}
            <div className="relative flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Event<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={eventSearch}
                onChange={e => {
                  setEventSearch(e.target.value)
                  setForm(p => ({ ...p, eventId: '' }))
                  setEventDropOpen(true)
                }}
                onFocus={() => setEventDropOpen(true)}
                onBlur={() => setTimeout(() => setEventDropOpen(false), 150)}
                placeholder="Search events…"
                autoComplete="off"
                className={inputCls}
              />
              {eventDropOpen && filteredEvents.length > 0 && (
                <div className="absolute top-full mt-1 w-full z-50 bg-white rounded-xl border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
                  {filteredEvents.map(ev => (
                    <button
                      key={ev.id}
                      type="button"
                      onMouseDown={() => selectEvent(ev)}
                      className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm text-gray-800 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium">{ev.eventName}</span>
                      <span className="text-gray-400 ml-1 text-xs">· {ev.eventCode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Expense type cards */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-700">
                Expense type<span className="text-red-500 ml-0.5">*</span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                {EXPENSE_TYPES.map(({ key, icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setExpenseType(key)}
                    className={`rounded-2xl border-2 p-4 flex flex-col items-center gap-1.5 transition-all ${
                      expenseType === key
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Amount (USD)" required>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amountUsd}
                  onChange={e => setForm(p => ({ ...p, amountUsd: e.target.value }))}
                  placeholder="45.00"
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  title="Date"
                  value={form.transactionDate}
                  onChange={e => setForm(p => ({ ...p, transactionDate: e.target.value }))}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Description */}
            <Field label="Description" required>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="E.g. Team lunch"
                className={inputCls}
                required
              />
            </Field>

            {/* Merchant */}
            <Field label="Merchant">
              <input
                type="text"
                value={form.merchantName}
                onChange={e => setForm(p => ({ ...p, merchantName: e.target.value }))}
                placeholder="Restaurant or vendor name"
                className={inputCls}
              />
            </Field>

            {/* Receipt upload */}
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-700">
                Receipt<span className="text-red-500 ml-0.5">*</span>
              </p>
              <FileUpload
                label="Drag & drop or click to upload"
                hint="JPG, PNG, PDF, WebP — max 10 MB"
                file={pendingFile}
                onFile={setPendingFile}
                onClear={() => setPendingFile(null)}
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
              >
                {loading ? 'Saving…' : 'Save expense'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError('') }}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

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
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white shadow-sm">
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
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link href={`/employee/expenses/${exp.id}`} className="hover:text-indigo-600">{exp.description}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{exp.category}</td>
                  <td className="px-4 py-3 font-medium">${Number(exp.amountUsd).toFixed(2)}</td>
                  <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(exp.status)}>{exp.status}</Badge></td>
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
              ))}
            </tbody>
          </table>
        )}
      </div>
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
