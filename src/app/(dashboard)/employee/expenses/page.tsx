'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FileUpload } from '@/components/ui/FileUpload'
import Link from 'next/link'
import type { TravelEvent } from '@/types/event'
import type { Expense } from '@/types/expense'

const CATEGORIES = ['MEALS', 'TRANSPORT', 'ACCOMMODATION', 'SUPPLIES', 'OTHER']
const SERVICES = ['Flights', 'Hotel', 'Car Rental', 'Food', 'Taxi', 'Other']

function ExpensesContent() {
  const params = useSearchParams()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [events, setEvents] = useState<TravelEvent[]>([])
  const [showForm, setShowForm] = useState(params.get('add') === '1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [manager, setManager] = useState<{ name: string; email: string } | null | undefined>(undefined)
  const [form, setForm] = useState({
    eventId: '',
    category: 'MEALS',
    service: '',
    amountUsd: '',
    currency: 'USD',
    description: '',
    merchantName: '',
    transactionDate: '',
  })

  useEffect(() => {
    fetch('/api/expenses').then((r) => r.json()).then(setExpenses)
    fetch('/api/events').then((r) => r.json()).then((data) => setEvents(data.filter((e: TravelEvent) => e.status !== 'CLOSED')))
    fetch('/api/users/me').then((r) => r.json()).then((data) => setManager(data.manager ?? null))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.eventId) { setError('Please select an event'); return }
    if (!pendingFile) { setError('A receipt is required — please attach a receipt before submitting'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amountUsd: Number(form.amountUsd),
        service: form.service || undefined,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
      setLoading(false)
      return
    }

    // Upload receipt
    if (pendingFile && data.expense) {
      const fd = new FormData()
      fd.append('file', pendingFile)
      fd.append('expenseId', data.expense.id)
      await fetch('/api/receipts/upload', { method: 'POST', body: fd })
    }

    const refreshed = await fetch('/api/expenses').then((r) => r.json())
    setExpenses(refreshed)
    setShowForm(false)
    setForm({ eventId: '', category: 'MEALS', service: '', amountUsd: '', currency: 'USD', description: '', merchantName: '', transactionDate: '' })
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
    const refreshed = await fetch('/api/expenses').then((r) => r.json())
    setExpenses(refreshed)
    setSubmittingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <Button onClick={() => setShowForm(!showForm)}>+ Add expense</Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800">New out-of-pocket expense</h2>

          {/* Approved by */}
          <div className="rounded-lg bg-indigo-50 px-4 py-3 text-sm">
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

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Event <span className="text-red-500">*</span></label>
            <select title="Event" value={form.eventId} onChange={(e) => setForm((p) => ({ ...p, eventId: e.target.value }))} required className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
              <option value="">Select event…</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.eventName} ({ev.eventCode})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Category</label>
              <select title="Category" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Service</label>
              <select title="Service" value={form.service} onChange={(e) => setForm((p) => ({ ...p, service: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                <option value="">Select service…</option>
                {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <Input label="Amount (USD)" type="number" step="0.01" value={form.amountUsd} onChange={(e) => setForm((p) => ({ ...p, amountUsd: e.target.value }))} required placeholder="45.00" />

          <Input label="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required placeholder="Team lunch" />
          <Input label="Merchant" value={form.merchantName} onChange={(e) => setForm((p) => ({ ...p, merchantName: e.target.value }))} placeholder="Restaurant name" />
          <Input label="Date" type="date" value={form.transactionDate} onChange={(e) => setForm((p) => ({ ...p, transactionDate: e.target.value }))} />

          <FileUpload label="Receipt *" onFile={setPendingFile} />
          {pendingFile && <p className="text-xs text-green-600">✓ {pendingFile.name} attached</p>}

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" loading={loading}>Save expense</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
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
              <span className="text-xs text-gray-400">{exp.transactionDate ? new Date(exp.transactionDate).toLocaleDateString('en-GB') : '—'}</span>
            </div>
            {exp.status === 'DRAFT' && (
              <button type="button" onClick={() => submitExpense(exp.id)} disabled={submittingId === exp.id}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
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
                  <td className="px-4 py-3 text-gray-400">{exp.transactionDate ? new Date(exp.transactionDate).toLocaleDateString('en-GB') : '—'}</td>
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
