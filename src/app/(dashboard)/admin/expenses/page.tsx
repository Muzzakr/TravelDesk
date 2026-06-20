'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'

type Expense = {
  id: string
  status: string
  amountUsd: string | number
  description: string
  category: string
  merchantName: string | null
  createdAt: string
  employee: { name: string; email: string }
  event: { eventCode: string; eventName: string }
}

const STATUS_BADGE: Record<string, 'blue' | 'green' | 'gray' | 'red' | 'yellow'> = {
  DRAFT: 'gray', SUBMITTED: 'blue', UNDER_REVIEW: 'yellow',
  APPROVED: 'green', REJECTED: 'red', PAID: 'green',
}

const STATUS_OPTIONS = ['', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'DRAFT']

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('SUBMITTED')
  const [acting, setActing] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectErr, setRejectErr] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/expenses')
    if (r.ok) setExpenses(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function approve(id: string) {
    setActing(id)
    await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' }),
    })
    await load()
    setActing(null)
  }

  async function reject(id: string) {
    if (!rejectNote.trim()) return
    setActing(id)
    const r = await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED', rejectionNote: rejectNote }),
    })
    if (!r.ok) {
      const d = await r.json()
      setRejectErr(d.error ?? 'Failed to reject')
      setActing(null)
    } else {
      setRejectId(null); setRejectNote(''); setRejectErr('')
      await load()
      setActing(null)
    }
  }

  function exportCSV() {
    const rows = filtered.map(e => [
      new Date(e.createdAt).toISOString().slice(0, 10),
      e.employee.name, e.employee.email,
      e.description, e.merchantName ?? '',
      e.category, e.event.eventName, e.event.eventCode,
      Number(e.amountUsd).toFixed(2), e.status,
    ])
    const header = ['Date', 'Employee', 'Email', 'Description', 'Merchant', 'Category', 'Event', 'Event Code', 'Amount (USD)', 'Status']
    const csv = [header, ...rows].map(r => r.map(v => JSON.stringify(v)).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = expenses.filter(e => !statusFilter || e.status === statusFilter)

  return (
    <div className="space-y-6">

      {/* Reject modal */}
      {rejectId && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/40" onClick={() => { setRejectId(null); setRejectNote(''); setRejectErr('') }} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Reject expense</h2>
              <textarea rows={3} placeholder="Reason for rejection (required)"
                value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none resize-none" />
              {rejectErr && <p className="text-sm text-red-600">{rejectErr}</p>}
              <div className="flex gap-3">
                <button type="button" disabled={!rejectNote.trim() || acting === rejectId}
                  onClick={() => reject(rejectId!)}
                  className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                  {acting === rejectId ? 'Rejecting…' : 'Reject'}
                </button>
                <button type="button" onClick={() => { setRejectId(null); setRejectNote(''); setRejectErr('') }}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">All company expenses — approve or reject directly</p>
        </div>
        <button type="button" onClick={exportCSV}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select title="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">No expenses found.</div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {filtered.map(e => (
              <div key={e.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{e.employee.name}</p>
                    <p className="text-sm text-gray-600">{e.description}</p>
                    <p className="text-xs text-gray-400">{e.event.eventName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-gray-900">${Number(e.amountUsd).toFixed(2)}</p>
                    <Badge variant={STATUS_BADGE[e.status] ?? 'gray'}>{e.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {e.status === 'SUBMITTED' && (
                    <>
                      <button type="button" disabled={acting === e.id} onClick={() => approve(e.id)}
                        className="rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {acting === e.id ? '…' : 'Approve'}
                      </button>
                      <button type="button" onClick={() => { setRejectId(e.id); setRejectNote(''); setRejectErr('') }}
                        className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-100">
                        Reject
                      </button>
                    </>
                  )}
                  <Link href={`/manager/approvals/expense/${e.id}`} className="text-xs font-medium text-indigo-600 hover:underline">View →</Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block rounded-xl border bg-white overflow-hidden">
            <table className="w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{e.employee.name}</p>
                      <p className="text-xs text-gray-400">{e.employee.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{e.description}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.category.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{e.event.eventName}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">${Number(e.amountUsd).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3"><Badge variant={STATUS_BADGE[e.status] ?? 'gray'}>{e.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {e.status === 'SUBMITTED' && (
                          <>
                            <button type="button" disabled={acting === e.id} onClick={() => approve(e.id)}
                              className="rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                              {acting === e.id ? '…' : 'Approve'}
                            </button>
                            <button type="button" onClick={() => { setRejectId(e.id); setRejectNote(''); setRejectErr('') }}
                              className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-100">
                              Reject
                            </button>
                          </>
                        )}
                        <Link href={`/manager/approvals/expense/${e.id}`} className="text-xs font-medium text-indigo-600 hover:underline whitespace-nowrap">View →</Link>
                      </div>
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
