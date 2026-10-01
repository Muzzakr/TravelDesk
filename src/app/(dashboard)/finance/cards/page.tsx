'use client'

import { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { PlusIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { LoadError } from '@/components/ui/LoadError'

type CardTransaction = {
  id: string
  transactionDate: string
  merchant: string
  amountUsd: number
  currency: string
  cardProgram: string
  cardId: string | null
  cardLastFour: string | null
  employeeId: string | null
  employeeName: string | null
  eventId: string | null
  status: string
}

type Event    = { id: string; eventName: string; eventCode: string }
type Employee = { id: string; name: string }

type CardReview = {
  id: string
  type: 'AMOUNT_MISMATCH' | 'MISSING_IN_STATEMENT'
  incomingAmountUsd: number | null
  incomingMerchant: string | null
  incomingCategory: string | null
  cardTransaction: {
    id: string
    merchant: string
    amountUsd: number
    category: string | null
    transactionDate: string
    cardId: string | null
    cardLastFour: string | null
  }
}

type CardMapping = {
  id: string
  cardId: string
  cardLastFour: string
  employee: { id: string; name: string; email: string }
}

type ImportSummary = {
  created: number
  skippedExisting: number
  skippedInvalidRows: number
  mismatchReviewsCreated: number
  missingReviewsCreated: number
  unmappedCardCount: number
}

const STATUS_COLORS: Record<string, 'gray' | 'yellow' | 'green' | 'blue'> = {
  PENDING_TAG: 'yellow',
  TAGGED:      'blue',
  SUBMITTED:   'green',
  MATCHED:     'green',
}

const EMPTY_FORM = { merchant: '', amountUsd: '', currency: 'USD', transactionDate: '', cardProgram: '', employeeId: '', eventId: '' }
const EMPTY_MAPPING_FORM = { cardId: '', cardLastFour: '', employeeId: '' }

const inputCls = 'rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none'

export default function CardTransactionsPage() {
  const [view, setView] = useState<'transactions' | 'reviews' | 'mappings'>('transactions')
  const [pendingReviewCount, setPendingReviewCount] = useState(0)

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

  const [loadError, setLoadError] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importErr, setImportErr] = useState('')

  const [reviews, setReviews] = useState<CardReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)

  const [mappings, setMappings] = useState<CardMapping[]>([])
  const [mappingsLoading, setMappingsLoading] = useState(true)
  const [mappingForm, setMappingForm] = useState(EMPTY_MAPPING_FORM)
  const [mappingSaving, setMappingSaving] = useState(false)
  const [mappingErr, setMappingErr] = useState('')
  const [mappingMsg, setMappingMsg] = useState('')

  async function load(status?: string) {
    setLoading(true)
    setLoadError(false)
    try {
      const url = status ? `/api/finance/cards?status=${status}` : '/api/finance/cards'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setTransactions(await res.json())
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  async function loadMeta() {
    try {
      const [evRes, usRes] = await Promise.all([fetch('/api/events'), fetch('/api/users')])
      if (evRes.ok) setEvents(await evRes.json())
      if (usRes.ok) {
        const users: Employee[] = await usRes.json()
        setEmployees(users.filter((u: any) => u.role === 'EMPLOYEE'))
      }
    } catch {
      // Tag dropdowns stay empty; the visible list error state covers the failure
    }
  }

  async function loadReviewCount() {
    try {
      const res = await fetch('/api/finance/card-reviews')
      if (res.ok) setPendingReviewCount((await res.json()).length)
    } catch {
      // badge just stays at its last known count
    }
  }

  useEffect(() => { load(); loadMeta(); loadReviewCount() }, [])

  async function loadReviews() {
    setReviewsLoading(true)
    try {
      const res = await fetch('/api/finance/card-reviews')
      if (res.ok) setReviews(await res.json())
    } finally {
      setReviewsLoading(false)
    }
  }

  async function loadMappings() {
    setMappingsLoading(true)
    try {
      const res = await fetch('/api/finance/card-mappings')
      if (res.ok) setMappings(await res.json())
    } finally {
      setMappingsLoading(false)
    }
  }

  function switchView(v: typeof view) {
    setView(v)
    if (v === 'reviews') loadReviews()
    if (v === 'mappings') loadMappings()
  }

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

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setImportErr(''); setImportSummary(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/finance/cards/import', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) { setImportErr(data.error ?? 'Import failed'); return }
      setImportSummary(data)
      await Promise.all([load(filter || undefined), loadReviewCount()])
    } catch {
      setImportErr('Import failed — check the file and try again.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function resolveReview(id: string, resolution: 'kept_existing' | 'kept_incoming' | 'kept' | 'removed') {
    setResolving(id)
    const res = await fetch(`/api/finance/card-reviews/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    })
    if (res.ok) {
      await Promise.all([loadReviews(), loadReviewCount(), load(filter || undefined)])
    }
    setResolving(null)
  }

  async function submitMapping(e: React.FormEvent) {
    e.preventDefault()
    if (!mappingForm.cardId || !mappingForm.cardLastFour || !mappingForm.employeeId) {
      setMappingErr('Fill in all fields.'); return
    }
    setMappingSaving(true); setMappingErr(''); setMappingMsg('')
    const res = await fetch('/api/finance/card-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mappingForm),
    })
    const data = await res.json()
    if (res.ok) {
      setMappingForm(EMPTY_MAPPING_FORM)
      setMappingMsg(data.retroactiveCount > 0 ? `Mapped — also applied to ${data.retroactiveCount} existing unassigned transaction(s).` : 'Mapped.')
      await loadMappings()
    } else {
      setMappingErr(data.error ?? 'Failed to save mapping')
    }
    setMappingSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Card transactions</h1>
        {view === 'transactions' && (
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" title="Import weekly statement" className="hidden" onChange={handleImportFile} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              <ArrowUpTrayIcon className="w-4 h-4" />
              {importing ? 'Importing…' : 'Import statement'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(v => !v); setFormErr('') }}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add transaction
            </button>
          </div>
        )}
      </div>

      {/* Top-level view switcher */}
      <div className="flex gap-2">
        {(['transactions', 'reviews', 'mappings'] as const).map((v) => (
          <button key={v} type="button" onClick={() => switchView(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${view === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
            {v === 'transactions' ? 'Transactions' : v === 'reviews' ? (
              <>Review changes{pendingReviewCount > 0 && <span className="ml-1.5 rounded-full bg-red-500 text-white text-xs px-1.5 py-0.5">{pendingReviewCount}</span>}</>
            ) : 'Card mappings'}
          </button>
        ))}
      </div>

      {importSummary && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-start justify-between gap-4">
          <p>
            Imported: <strong>{importSummary.created}</strong> new, <strong>{importSummary.skippedExisting}</strong> already had them
            {importSummary.mismatchReviewsCreated > 0 && <>, <strong>{importSummary.mismatchReviewsCreated}</strong> need review</>}
            {importSummary.missingReviewsCreated > 0 && <>, <strong>{importSummary.missingReviewsCreated}</strong> flagged missing</>}
            {importSummary.unmappedCardCount > 0 && <>, <strong>{importSummary.unmappedCardCount}</strong> card(s) need mapping</>}.
          </p>
          <button type="button" onClick={() => setImportSummary(null)} className="text-green-600 hover:text-green-800 shrink-0">✕</button>
        </div>
      )}
      {importErr && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{importErr}</p>}

      {view === 'transactions' && (
        <>
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

          {loadError && !loading && <LoadError onRetry={() => load(filter || undefined)} />}

          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : transactions.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center space-y-2">
              <p className="text-sm text-gray-400">No transactions found.</p>
              <p className="text-xs text-gray-300">Import a weekly statement, add one manually, or connect a card provider webhook.</p>
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
                        {!t.employeeName && t.cardId && <p className="text-xs text-amber-600">Card {t.cardId}/{t.cardLastFour} needs mapping</p>}
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
                          className="w-full rounded-lg border border-gray-200 px-2 py-2.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none">
                          <option value="">Employee…</option>
                          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                          <select title="Tag to event" value={selectedEvent[t.id] ?? ''}
                            onChange={e => setSelectedEvent(p => ({ ...p, [t.id]: e.target.value }))}
                            className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-2.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none">
                            <option value="">Select event…</option>
                            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.eventCode} – {ev.eventName}</option>)}
                          </select>
                          <button type="button" onClick={() => tagTransaction(t.id)} disabled={!selectedEvent[t.id] || tagging === t.id}
                            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
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
                            <div className="space-y-1">
                              <select title="Assign employee" value={selectedEmployee[t.id] ?? ''}
                                onChange={e => setSelectedEmployee(p => ({ ...p, [t.id]: e.target.value }))}
                                className="rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none">
                                <option value="">— assign —</option>
                                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                              </select>
                              {t.cardId && <p className="text-xs text-amber-600">Card {t.cardId}/{t.cardLastFour} needs mapping</p>}
                            </div>
                          ) : (t.employeeName ?? '—')}
                        </td>
                        <td className="px-4 py-3"><Badge variant={STATUS_COLORS[t.status] ?? 'gray'}>{t.status.replace('_', ' ')}</Badge></td>
                        <td className="px-4 py-3">
                          {t.status === 'PENDING_TAG' ? (
                            <div className="flex items-center gap-2">
                              <select title="Tag to event" value={selectedEvent[t.id] ?? ''}
                                onChange={e => setSelectedEvent(p => ({ ...p, [t.id]: e.target.value }))}
                                className="rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none">
                                <option value="">Select event…</option>
                                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.eventCode} – {ev.eventName}</option>)}
                              </select>
                              <button type="button" onClick={() => tagTransaction(t.id)} disabled={!selectedEvent[t.id] || tagging === t.id}
                                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
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
        </>
      )}

      {view === 'reviews' && (
        reviewsLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center">
            <p className="text-sm text-gray-400">Nothing needs review right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={r.type === 'AMOUNT_MISMATCH' ? 'yellow' : 'red'}>
                    {r.type === 'AMOUNT_MISMATCH' ? 'Amount changed' : 'Missing from latest statement'}
                  </Badge>
                  <span className="text-xs text-gray-400">{new Date(r.cardTransaction.transactionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>

                {r.type === 'AMOUNT_MISMATCH' ? (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg border border-gray-100 p-3">
                      <p className="text-xs text-gray-400 mb-1">Currently on file</p>
                      <p className="font-semibold text-gray-900">${Number(r.cardTransaction.amountUsd).toFixed(2)}</p>
                      <p className="text-gray-500">{r.cardTransaction.merchant}</p>
                      {r.cardTransaction.category && <p className="text-xs text-gray-400">{r.cardTransaction.category}</p>}
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs text-amber-600 mb-1">In the newer statement</p>
                      <p className="font-semibold text-gray-900">${Number(r.incomingAmountUsd ?? 0).toFixed(2)}</p>
                      <p className="text-gray-500">{r.incomingMerchant}</p>
                      {r.incomingCategory && <p className="text-xs text-gray-400">{r.incomingCategory}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-100 p-3 text-sm">
                    <p className="font-semibold text-gray-900">{r.cardTransaction.merchant} — ${Number(r.cardTransaction.amountUsd).toFixed(2)}</p>
                    <p className="text-gray-500">Card {r.cardTransaction.cardId}/{r.cardTransaction.cardLastFour} — no longer appears in a statement window that should cover it.</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {r.type === 'AMOUNT_MISMATCH' ? (
                    <>
                      <button type="button" disabled={resolving === r.id} onClick={() => resolveReview(r.id, 'kept_existing')}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                        Keep existing
                      </button>
                      <button type="button" disabled={resolving === r.id} onClick={() => resolveReview(r.id, 'kept_incoming')}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
                        Keep new
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" disabled={resolving === r.id} onClick={() => resolveReview(r.id, 'kept')}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                        Keep
                      </button>
                      <button type="button" disabled={resolving === r.id} onClick={() => resolveReview(r.id, 'removed')}
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40">
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {view === 'mappings' && (
        <div className="space-y-6">
          <form onSubmit={submitMapping} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800">Map a card to an employee</h2>
            <p className="text-xs text-gray-500">Set once per physical card — every future weekly import reuses it automatically, and it applies retroactively to any of that card&apos;s transactions already sitting unassigned.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Card ID *</label>
                <input className={inputCls} value={mappingForm.cardId} onChange={e => setMappingForm(f => ({ ...f, cardId: e.target.value }))} placeholder="e.g. YQX013" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Card last four *</label>
                <input className={inputCls} value={mappingForm.cardLastFour} onChange={e => setMappingForm(f => ({ ...f, cardLastFour: e.target.value }))} placeholder="e.g. 2202" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Employee *</label>
                <select className={inputCls} title="Employee" value={mappingForm.employeeId} onChange={e => setMappingForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">— select —</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
            </div>
            {mappingErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{mappingErr}</p>}
            {mappingMsg && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{mappingMsg}</p>}
            <button type="submit" disabled={mappingSaving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-semibold">
              {mappingSaving ? 'Saving…' : 'Save mapping'}
            </button>
          </form>

          {mappingsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : mappings.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <p className="text-sm text-gray-400">No cards mapped yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-[500px] w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Card ID</th>
                    <th className="px-4 py-3 text-left">Last four</th>
                    <th className="px-4 py-3 text-left">Employee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {mappings.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.cardId}</td>
                      <td className="px-4 py-3 text-gray-500">{m.cardLastFour}</td>
                      <td className="px-4 py-3 text-gray-700">{m.employee.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
