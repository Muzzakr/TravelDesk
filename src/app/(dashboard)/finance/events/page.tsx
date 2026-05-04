'use client'

import { useState, useEffect } from 'react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

type Event = {
  id: string
  eventCode: string
  eventName: string
  status: string
  eventDate: string | null
  budgetUsd: number
  approvedSpendUsd: number
}

export default function FinanceEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/events')
    if (res.ok) setEvents(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(ev: Event) {
    setEditingId(ev.id)
    setBudgetInput(Number(ev.budgetUsd).toFixed(2))
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setBudgetInput('')
    setError('')
  }

  async function saveBudget(id: string) {
    const val = parseFloat(budgetInput)
    if (isNaN(val) || val < 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budgetUsd: val }),
    })
    if (res.ok) {
      await load()
      setEditingId(null)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Events &amp; Budgets</h1>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          No events found.
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {events.map((ev) => {
              const budget = Number(ev.budgetUsd)
              const spent = Number(ev.approvedSpendUsd)
              const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
              const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
              const isEditing = editingId === ev.id
              return (
                <div key={ev.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{ev.eventName}</p>
                      <p className="text-xs font-mono text-gray-400">{ev.eventCode}</p>
                    </div>
                    <Badge variant={statusToBadgeVariant(ev.status)}>{ev.status}</Badge>
                  </div>
                  {ev.eventDate && (
                    <p className="text-xs text-gray-400">{new Date(ev.eventDate).toLocaleDateString()}</p>
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Spent: <span className="font-medium text-gray-800">${spent.toFixed(0)}</span></span>
                      <span>Budget: <span className="font-medium text-gray-800">${budget.toFixed(0)}</span> ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-gray-500">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="w-28 rounded border border-indigo-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => saveBudget(ev.id)}
                        disabled={saving}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={cancelEdit} className="text-xs text-gray-400 hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(ev)}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Edit budget
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[700px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Event Name</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Budget (USD)</th>
                  <th className="px-4 py-3 text-right">Spent</th>
                  <th className="px-4 py-3 text-left w-48">Usage</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map((ev) => {
                  const budget = Number(ev.budgetUsd)
                  const spent = Number(ev.approvedSpendUsd)
                  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
                  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                  const isEditing = editingId === ev.id
                  return (
                    <tr key={ev.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{ev.eventCode}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{ev.eventName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusToBadgeVariant(ev.status)}>{ev.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={budgetInput}
                            onChange={(e) => setBudgetInput(e.target.value)}
                            className="w-28 rounded border border-indigo-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            autoFocus
                          />
                        ) : (
                          `$${budget.toFixed(0)}`
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">${spent.toFixed(0)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-gray-100">
                            <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveBudget(ev.id)}
                              disabled={saving}
                              className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={cancelEdit} className="text-xs text-gray-400 hover:underline">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(ev)}
                            className="text-xs font-medium text-indigo-600 hover:underline"
                          >
                            Edit budget
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
