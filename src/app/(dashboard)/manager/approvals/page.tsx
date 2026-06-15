'use client'

import { useState, useEffect } from 'react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'
import { Check, XCircle } from 'lucide-react'

interface TravelRequest {
  id: string; status: string; origin: string; destination: string; createdAt: string
  estimatedCostUsd: number | null
  employee: { name: string }; event: { eventName: string }
}
interface Expense {
  id: string; status: string; description: string; amountUsd: number; createdAt: string
  employee: { name: string }; event: { eventName: string }
}

export default function ApprovalsPage() {
  const [travelRequests, setTravelRequests] = useState<TravelRequest[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTR, setSelectedTR] = useState<Set<string>>(new Set())
  const [selectedExp, setSelectedExp] = useState<Set<string>>(new Set())
  const [bulkNote, setBulkNote] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [trRes, expRes] = await Promise.all([
      fetch('/api/travel-requests'),
      fetch('/api/expenses'),
    ])
    if (trRes.ok) {
      const all: TravelRequest[] = await trRes.json()
      setTravelRequests(all.filter(r => r.status === 'PENDING_MANAGER'))
    }
    if (expRes.ok) {
      const all: Expense[] = await expRes.json()
      setExpenses(all.filter(e => ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function toggleTR(id: string) {
    setSelectedTR(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAllTR() {
    setSelectedTR(prev => prev.size === travelRequests.length ? new Set() : new Set(travelRequests.map(r => r.id)))
  }
  function toggleExp(id: string) {
    setSelectedExp(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAllExp() {
    setSelectedExp(prev => prev.size === expenses.length ? new Set() : new Set(expenses.map(e => e.id)))
  }

  async function bulkApproveTR() {
    setProcessing(true); setError('')
    await Promise.all([...selectedTR].map(id =>
      fetch(`/api/travel-requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })
    ))
    setSelectedTR(new Set()); await load(); setProcessing(false)
  }

  async function bulkRejectTR() {
    if (!bulkNote.trim()) { setError('Please enter a rejection reason.'); return }
    setProcessing(true); setError('')
    await Promise.all([...selectedTR].map(id =>
      fetch(`/api/travel-requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', rejectionNote: bulkNote }),
      })
    ))
    setSelectedTR(new Set()); setBulkNote(''); await load(); setProcessing(false)
  }

  async function bulkApproveExp() {
    setProcessing(true); setError('')
    await Promise.all([...selectedExp].map(id =>
      fetch(`/api/expenses/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })
    ))
    setSelectedExp(new Set()); await load(); setProcessing(false)
  }

  async function bulkRejectExp() {
    if (!bulkNote.trim()) { setError('Please enter a rejection reason.'); return }
    setProcessing(true); setError('')
    await Promise.all([...selectedExp].map(id =>
      fetch(`/api/expenses/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', rejectionNote: bulkNote }),
      })
    ))
    setSelectedExp(new Set()); setBulkNote(''); await load(); setProcessing(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      {/* Bulk action bar */}
      {(selectedTR.size > 0 || selectedExp.size > 0) && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-800">
            {selectedTR.size + selectedExp.size} item{selectedTR.size + selectedExp.size > 1 ? 's' : ''} selected
          </p>
          <input
            type="text" title="Rejection reason" placeholder="Rejection reason (required for reject)…"
            value={bulkNote} onChange={e => setBulkNote(e.target.value)}
            className="w-full max-w-md rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <div className="flex flex-wrap gap-2">
            {selectedTR.size > 0 && (
              <>
                <button type="button" onClick={bulkApproveTR} disabled={processing}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  <Check className="w-4 h-4 inline-block mr-1 -mt-0.5" />Approve {selectedTR.size} request{selectedTR.size > 1 ? 's' : ''}
                </button>
                <button type="button" onClick={bulkRejectTR} disabled={processing}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  <XCircle className="w-4 h-4 inline-block mr-1 -mt-0.5" />Reject {selectedTR.size} request{selectedTR.size > 1 ? 's' : ''}
                </button>
              </>
            )}
            {selectedExp.size > 0 && (
              <>
                <button type="button" onClick={bulkApproveExp} disabled={processing}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  <Check className="w-4 h-4 inline-block mr-1 -mt-0.5" />Approve {selectedExp.size} expense{selectedExp.size > 1 ? 's' : ''}
                </button>
                <button type="button" onClick={bulkRejectExp} disabled={processing}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  <XCircle className="w-4 h-4 inline-block mr-1 -mt-0.5" />Reject {selectedExp.size} expense{selectedExp.size > 1 ? 's' : ''}
                </button>
              </>
            )}
            <button type="button" onClick={() => { setSelectedTR(new Set()); setSelectedExp(new Set()) }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Travel Requests */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Travel requests ({travelRequests.length})</h2>
        </div>
        {travelRequests.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No pending travel requests.</div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" title="Select all travel requests"
                      checked={selectedTR.size === travelRequests.length && travelRequests.length > 0}
                      onChange={toggleAllTR}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  </th>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-right">Est. Cost</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {travelRequests.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${selectedTR.has(r.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" title={`Select ${r.employee.name}`}
                        checked={selectedTR.has(r.id)} onChange={() => toggleTR(r.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.employee.name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.origin} → {r.destination}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{r.event.eventName}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(0)}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                    <td className="px-4 py-3">
                      <Link href={`/manager/approvals/travel/${r.id}`} className="text-xs font-medium text-indigo-600 hover:underline">Review →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Expenses */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Expenses ({expenses.length})</h2>
        </div>
        {expenses.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">No pending expenses.</div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" title="Select all expenses"
                      checked={selectedExp.size === expenses.length && expenses.length > 0}
                      onChange={toggleAllExp}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  </th>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.map((ex) => (
                  <tr key={ex.id} className={`hover:bg-gray-50 ${selectedExp.has(ex.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" title={`Select ${ex.employee.name} expense`}
                        checked={selectedExp.has(ex.id)} onChange={() => toggleExp(ex.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{ex.employee.name}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{ex.description}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">{ex.event.eventName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">${Number(ex.amountUsd).toFixed(2)}</td>
                    <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(ex.status)}>{ex.status}</Badge></td>
                    <td className="px-4 py-3">
                      <Link href={`/manager/approvals/expense/${ex.id}`} className="text-xs font-medium text-indigo-600 hover:underline">Review →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}