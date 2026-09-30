'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import { LoadError } from '@/components/ui/LoadError'

type CardCharge = {
  id: string
  transactionDate: string
  merchant: string
  amountUsd: number
  cardProgram: string
  category: string | null
  vehicle: string | null
  eventId: string | null
  event: { id: string; eventCode: string; eventName: string } | null
  receiptKey: string | null
  status: string
}

type Event = { id: string; eventName: string; eventCode: string }

const STATUS_COLORS: Record<string, 'gray' | 'yellow' | 'blue' | 'green'> = {
  PENDING_TAG: 'yellow',
  TAGGED: 'blue',
  SUBMITTED: 'green',
  MATCHED: 'green',
}

const inputCls = 'rounded-lg border border-gray-200 px-3 py-2 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none'

export default function MyCardChargesPage() {
  const [charges, setCharges] = useState<CardCharge[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [selectedEvent, setSelectedEvent] = useState<Record<string, string>>({})
  const [selectedFile, setSelectedFile] = useState<Record<string, File | null>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      const [chargesRes, eventsRes] = await Promise.all([fetch('/api/employee/card-charges'), fetch('/api/events')])
      if (!chargesRes.ok) throw new Error(`HTTP ${chargesRes.status}`)
      setCharges(await chargesRes.json())
      if (eventsRes.ok) setEvents(await eventsRes.json())
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function submit(id: string) {
    const eventId = selectedEvent[id]
    const file = selectedFile[id]
    if (!eventId && !file) return

    setSaving(id)
    setErrors((e) => ({ ...e, [id]: '' }))

    const body = new FormData()
    if (eventId) body.append('eventId', eventId)
    if (file) body.append('file', file)

    const res = await fetch(`/api/employee/card-charges/${id}`, { method: 'POST', body })
    if (res.ok) {
      setSelectedEvent((p) => ({ ...p, [id]: '' }))
      setSelectedFile((p) => ({ ...p, [id]: null }))
      await load()
    } else {
      const d = await res.json()
      setErrors((e) => ({ ...e, [id]: d.error ?? 'Failed to save' }))
    }
    setSaving(null)
  }

  const needsInput = charges.filter((c) => c.status === 'PENDING_TAG' || c.status === 'TAGGED')
  const done = charges.filter((c) => c.status === 'SUBMITTED' || c.status === 'MATCHED')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My card charges</h1>
        <p className="mt-1 text-gray-500">Charges made on your company card — the company already paid for these, so there&apos;s nothing to submit for reimbursement. Just add which event each one was for and a receipt.</p>
      </div>

      {loadError && !loading && <LoadError onRetry={load} />}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Needs your input {needsInput.length > 0 && <span className="text-sm font-normal text-gray-400">({needsInput.length})</span>}</h2>
            {needsInput.length === 0 ? (
              <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">Nothing needs your attention right now.</div>
            ) : (
              <div className="space-y-3">
                {needsInput.map((c) => (
                  <div key={c.id} className="rounded-xl border bg-white p-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">{c.merchant}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(c.transactionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                          {c.category && <> · {c.category}</>}
                          {c.vehicle && <> · {c.vehicle}</>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900">${Number(c.amountUsd).toFixed(2)}</p>
                        <div className="mt-1"><Badge variant={STATUS_COLORS[c.status] ?? 'gray'}>{c.status.replace('_', ' ')}</Badge></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {!c.eventId ? (
                        <select
                          title="Which event was this for?"
                          className={inputCls}
                          value={selectedEvent[c.id] ?? ''}
                          onChange={(e) => setSelectedEvent((p) => ({ ...p, [c.id]: e.target.value }))}
                        >
                          <option value="">Which event was this for?</option>
                          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.eventCode} – {ev.eventName}</option>)}
                        </select>
                      ) : (
                        <p className="text-sm text-gray-600 flex items-center">Event: <span className="ml-1 font-medium text-gray-900">{c.event ? `${c.event.eventCode} – ${c.event.eventName}` : c.eventId}</span></p>
                      )}

                      {!c.receiptKey ? (
                        <input
                          title="Upload a receipt"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                          onChange={(e) => setSelectedFile((p) => ({ ...p, [c.id]: e.target.files?.[0] ?? null }))}
                        />
                      ) : (
                        <p className="text-sm text-green-700">✓ Receipt attached</p>
                      )}
                    </div>

                    {errors[c.id] && <p className="text-sm text-red-600">{errors[c.id]}</p>}

                    {(!c.eventId || !c.receiptKey) && (
                      <button
                        type="button"
                        onClick={() => submit(c.id)}
                        disabled={saving === c.id || (!selectedEvent[c.id] && !selectedFile[c.id])}
                        className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium"
                      >
                        {saving === c.id ? 'Saving…' : 'Save'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {done.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">Already submitted</h2>
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Merchant</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Event</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {done.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 text-gray-500">{new Date(c.transactionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.merchant}</td>
                        <td className="px-4 py-3 text-gray-900">${Number(c.amountUsd).toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-500">{c.event ? `${c.event.eventCode} – ${c.event.eventName}` : '—'}</td>
                        <td className="px-4 py-3"><Badge variant={STATUS_COLORS[c.status] ?? 'gray'}>{c.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
