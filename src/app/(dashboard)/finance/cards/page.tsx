'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import { PlusIcon } from '@heroicons/react/24/outline'

type CardTransaction = {
  id: string
  transactionDate: string
  merchant: string
  amountUsd: number
  currency: string
  cardProgram: string
  employeeId: string | null
  employeeName: string | null
  eventId: string | null
  status: string
}

type Event    = { id: string; eventName: string; eventCode: string }
type Employee = { id: string; name: string }

const STATUS_COLORS: Record<string, 'gray' | 'yellow' | 'green' | 'blue'> = {
  PENDING_TAG: 'yellow',
  TAGGED:      'blue',
  SUBMITTED:   'green',
  MATCHED:     'green',
}

const EMPTY_FORM = { merchant: '', amountUsd: '', currency: 'USD', transactionDate: '', cardProgram: '', employeeId: '', eventId: '' }

export default function CardTransactionsPage() {
  const [transactions, setTransactions] = useState<CardTransaction[]>([])
  const [events,       setEvents]       = useState<Event[]>([])
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [filter,       setFilter]       = useState('')
  const [tagging,      setTagging]      = useState<string | null>(null)
  const [selectedEvent,    setSelectedEvent]    = useState<Record<string, string>>({})
  const [selectedEmployee, setSelectedEmployee] = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)
  const [formErr,  setFormErr]  = useState('')

  async function load(status?: string) {
    setLoading(true)
    const url = status ? `/api/finance/cards?status=${status}` : '/api/finance/cards'
    const res = await fetch(url)
    if (res.ok) setTransactions(await res.json())
    setLoading(false)
  }

  async function loadMeta() {
    const [evRes, usRes] = await Promise.all([fetch('/api/events'), fetch('/api/users')])
    if (evRes.ok) setEvents(await evRes.json())
    if (usRes.ok) {
      const users: Employee[] = await usRes.json()
      setEmployees(users.filter((u: any) => u.role === 'EMPLOYEE'))
    }
  }

  useEffect(() => { load(); loadMeta() }, [])

  async function tagTransaction(id: string) {
    const eventId    = selectedEvent[id]
    const employeeId = selectedEmployee[id]
    if (!eventId) return
    setTagging(id); setError('')
    const res = await fetch(`/api/finance/cards?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, ...(employeeId ? { employeeId } : {}) }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed to tag') }
    else await load(filter || undefined)
    setTagging(null)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form.merchant || !form.amountUsd || !form.transactionDate || !form.cardProgram) {
      setFormErr('Fill in all required fields.'); return
    }
    setSaving(true); setFormErr('')
    const res = await fetch('/api/finance/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant:        form.merchant,
        amountUsd:       parseFloat(form.amountUsd),
        currency:        form.currency || 'USD',
        transactionDate: form.transactionDate,
        cardProgram:     form.cardProgram,
        ...(form.employeeId ? { employeeId: form.employeeId } : {}),
        ...(form.eventId    ? { eventId:    form.eventId    } : {}),
      }),
    })
    if (res.ok) {
      setForm(EMPTY_FORM); setShowForm(false)
      await load(filter || undefined)
    } else {
      const d = await res.json()
      setFormErr(d.error ?? 'Failed to add transaction')
    }
    setSaving(false)
  }

  function applyFilter(status: string) { setFilter(status); load(status || undefined) }

  const inputCls = 'rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Card transactions</h1>
        <button
          type="button"
          onClick={() => { setShowForm(v => !v); setFormErr('') }}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add transaction
        </button>
      </div>

      {/* Manual entry form */}
      {showForm && (
        <form onSubmit={submitForm} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">Add transaction manually</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Merchant *</label>
              <input className={inputCls} value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} placeholder="e.g. Sheraton Hotel" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Amount (USD) *</label>
              <input className={inputCls} type="number" step="0.01" min="0.01" value={form.amountUsd} onChange={e => setForm(f => ({ ...f, amountUsd: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Date *</label>
              <input className={inputCls} type="date" title="Transaction date" value={form.transactionDate} onChange={e => setForm(f => ({ ...f, transactionDate: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Card program *</label>
              <input className={inputCls} value={form.cardProgram} onChange={e => setForm(f => ({ ...f, cardProgram: e.target.value }))} placeholder="e.g. Visa Business, Pleo" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Currency</label>
              <input className={inputCls} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="USD" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Employee</label>
              <select className={inputCls} title="Employee" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                <option value="">— unassigned —</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-600">Tag to event</label>
              <select className={inputCls} title="Tag to event" value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}>
                <option value="">— tag later —</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.eventCode} – {ev.eventName}</option>)}
              </select>
            </div>
          </div>
          {formErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formErr}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-semibold">
              {saving ? 'Saving…' : 'Add transaction'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap no-scrollbar">
        {['', 'PENDING_TAG', 'TAGGED', 'SUBMITTED', 'MATCHED'].map((s) => (
          <button key={s} type="button" onClick={() => applyFilter(s)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center space-y-2">
          <p className="text-sm text-gray-400">No transactions found.</p>
          <p className="text-xs text-gray-300">Add one manually or connect a card provider webhook.</p>
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{t.merchant}</p>
                    <p className="text-xs text-gray-400">{new Date(t.transactionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} · {t.cardProgram}</p>
                    {t.employeeName && <p className="text-xs text-gray-500">{t.employeeName}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-gray-900">${Number(t.amountUsd).toFixed(2)}</p>
                    {t.currency !== 'USD' && <p className="text-xs text-gray-400">{t.currency}</p>}
                    <div className="mt-1"><Badge variant={STATUS_COLORS[t.status] ?? 'gray'}>{t.status.replace('_', ' ')}</Badge></div>
                  </div>
                </div>
                {t.status === 'PENDING_TAG' && (
                  <div className="space-y-2 pt-1">
                    <select title="Assign employee" value={selectedEmployee[t.id] ?? ''}
                      onChange={e => setSelectedEmployee(p => ({ ...p, [t.id]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none">
                      <option value="">Employee…</option>
                      {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                      <select title="Tag to event" value={selectedEvent[t.id] ?? ''}
                        onChange={e => setSelectedEvent(p => ({ ...p, [t.id]: e.target.value }))}
                        className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none">
                        <option value="">Select event…</option>
                        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.eventCode} – {ev.eventName}</option>)}
                      </select>
                      <button type="button" onClick={() => tagTransaction(t.id)} disabled={!selectedEvent[t.id] || tagging === t.id}
                        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
                        {tagging === t.id ? 'Saving…' : 'Tag'}
                      </button>
                    </div>
                  </div>
                )}
                {t.status !== 'PENDING_TAG' && <p className="text-xs text-gray-400">{t.eventId ? 'Tagged to event' : '—'}</p>}
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[700px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Merchant</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Card program</th>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Tag to event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{new Date(t.transactionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{t.merchant}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      ${Number(t.amountUsd).toFixed(2)}
                      {t.currency !== 'USD' && <span className="ml-1 text-xs text-gray-400">{t.currency}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.cardProgram}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {t.status === 'PENDING_TAG' && !t.employeeName ? (
                        <select title="Assign employee" value={selectedEmployee[t.id] ?? ''}
                          onChange={e => setSelectedEmployee(p => ({ ...p, [t.id]: e.target.value }))}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none">
                          <option value="">— assign —</option>
                          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                      ) : (t.employeeName ?? '—')}
                    </td>
                    <td className="px-4 py-3"><Badge variant={STATUS_COLORS[t.status] ?? 'gray'}>{t.status.replace('_', ' ')}</Badge></td>
                    <td className="px-4 py-3">
                      {t.status === 'PENDING_TAG' ? (
                        <div className="flex items-center gap-2">
                          <select title="Tag to event" value={selectedEvent[t.id] ?? ''}
                            onChange={e => setSelectedEvent(p => ({ ...p, [t.id]: e.target.value }))}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none">
                            <option value="">Select event…</option>
                            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.eventCode} – {ev.eventName}</option>)}
                          </select>
                          <button type="button" onClick={() => tagTransaction(t.id)} disabled={!selectedEvent[t.id] || tagging === t.id}
                            className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
                            {tagging === t.id ? 'Saving…' : 'Tag'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">{t.eventId ? 'Tagged' : '—'}</span>
                      )}
                    </td>
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
