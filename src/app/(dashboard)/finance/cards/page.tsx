'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'

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

type Event = { id: string; eventName: string; eventCode: string }

const STATUS_COLORS: Record<string, 'gray' | 'yellow' | 'green' | 'blue'> = {
  PENDING_TAG: 'yellow',
  TAGGED: 'blue',
  SUBMITTED: 'green',
}

export default function CardTransactionsPage() {
  const [transactions, setTransactions] = useState<CardTransaction[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [filter, setFilter] = useState('')
  const [tagging, setTagging] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(status?: string) {
    setLoading(true)
    const url = status ? `/api/finance/cards?status=${status}` : '/api/finance/cards'
    const res = await fetch(url)
    if (res.ok) setTransactions(await res.json())
    setLoading(false)
  }

  async function loadEvents() {
    const res = await fetch('/api/events')
    if (res.ok) setEvents(await res.json())
  }

  useEffect(() => { load(); loadEvents() }, [])

  async function tagTransaction(id: string) {
    const eventId = selectedEvent[id]
    if (!eventId) return
    setTagging(id)
    setError('')
    const res = await fetch(`/api/finance/cards?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to tag transaction')
    } else {
      await load(filter || undefined)
    }
    setTagging(null)
  }

  function applyFilter(status: string) {
    setFilter(status)
    load(status || undefined)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Card transactions</h1>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {['', 'PENDING_TAG', 'TAGGED', 'SUBMITTED'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => applyFilter(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">No transactions found.</div>
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
                    <div className="mt-1">
                      <Badge variant={STATUS_COLORS[t.status] ?? 'gray'}>{t.status.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                </div>
                {t.status === 'PENDING_TAG' && (
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      title="Tag to event"
                      value={selectedEvent[t.id] ?? ''}
                      onChange={(e) => setSelectedEvent((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select event…</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>{ev.eventCode} – {ev.eventName}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => tagTransaction(t.id)}
                      disabled={!selectedEvent[t.id] || tagging === t.id}
                      className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {tagging === t.id ? 'Saving…' : 'Tag'}
                    </button>
                  </div>
                )}
                {t.status !== 'PENDING_TAG' && t.eventId && (
                  <p className="text-xs text-gray-400">Tagged to event</p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
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
                    <td className="px-4 py-3 text-gray-700">{t.employeeName ?? '—'}</td>
                    <td className="px-4 py-3"><Badge variant={STATUS_COLORS[t.status] ?? 'gray'}>{t.status.replace('_', ' ')}</Badge></td>
                    <td className="px-4 py-3">
                      {t.status === 'PENDING_TAG' ? (
                        <div className="flex items-center gap-2">
                          <select
                            title="Tag to event"
                            value={selectedEvent[t.id] ?? ''}
                            onChange={(e) => setSelectedEvent((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="">Select event…</option>
                            {events.map((ev) => (
                              <option key={ev.id} value={ev.id}>{ev.eventCode} – {ev.eventName}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => tagTransaction(t.id)}
                            disabled={!selectedEvent[t.id] || tagging === t.id}
                            className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                          >
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
