'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Receipt, Clock, CheckCircle, CreditCard } from 'lucide-react'

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

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PAID', label: 'Paid' },
  { value: 'DRAFT', label: 'Draft' },
]

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState('SUBMITTED')
  const [search, setSearch]     = useState('')
  const [acting, setActing]     = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectErr, setRejectErr]   = useState('')

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

  // KPI counts
  const counts = useMemo(() => ({
    total:    expenses.length,
    pending:  expenses.filter(e => e.status === 'SUBMITTED' || e.status === 'UNDER_REVIEW').length,
    approved: expenses.filter(e => e.status === 'APPROVED').length,
    paid:     expenses.filter(e => e.status === 'PAID').length,
  }), [expenses])

  const KPI_CARDS = [
    { label: 'Total expenses',       value: counts.total,    Icon: Receipt,      color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Awaiting approval',    value: counts.pending,  Icon: Clock,        color: 'bg-amber-50 text-amber-600' },
    { label: 'Approved',             value: counts.approved, Icon: CheckCircle,  color: 'bg-green-50 text-green-600' },
    { label: 'Paid',                 value: counts.paid,     Icon: CreditCard,   color: 'bg-blue-50 text-blue-600' },
  ]

  // Client-side filter + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return expenses.filter(e => {
      if (statusFilter && e.status !== statusFilter) return false
      if (!q) return true
      return (
        e.employee.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.event.eventName.toLowerCase().includes(q) ||
        e.event.eventCode.toLowerCase().includes(q) ||
        (e.merchantName ?? '').toLowerCase().includes(q)
      )
    })
  }, [expenses, statusFilter, search])

  return (
    <div className="space-y-6">

      {/* ── Reject modal ── */}
      {rejectId && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/40" onClick={() => { setRejectId(null); setRejectNote(''); setRejectErr('') }} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
              <h2 className="text-base font-semibold text-gray-900">Reject expense</h2>
              <textarea rows={3} placeholder="Reason for rejection (required)"
                value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none resize-none" />
              {rejectErr && <p className="text-sm text-red-600">{rejectErr}</p>}
              <div className="flex gap-3">
                <button type="button" disabled={!rejectNote.trim() || acting === rejectId}
                  onClick={() => reject(rejectId!)}
                  className="rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 min-h-[44px]">
                  {acting === rejectId ? 'Rejecting…' : 'Reject'}
                </button>
                <button type="button" onClick={() => { setRejectId(null); setRejectNote(''); setRejectErr('') }}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 min-h-[44px]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Expenses</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{expenses.length} total</span>
          <button type="button" onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <select title="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:border-indigo-500 outline-none">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="flex gap-1 flex-1 min-w-[180px]">
          <input
            type="text"
            placeholder="Search employee, description, event…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm flex-1 focus:border-indigo-500 outline-none"
          />
          {(statusFilter !== 'SUBMITTED' || search) && (
            <button type="button" onClick={() => { setStatusFilter('SUBMITTED'); setSearch('') }}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          <p className="text-sm text-gray-500 font-medium">No expenses found</p>
          {(statusFilter || search) && (
            <button type="button" onClick={() => { setStatusFilter(''); setSearch('') }}
              className="mt-3 text-xs text-indigo-600 hover:underline">Clear filters</button>
          )}
        </div>
      ) : (
        <>
          {/* ── Mobile cards ── */}
          <div className="sm:hidden space-y-3">
            {filtered.map(e => (
              <div key={e.id} className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{e.employee.name}</p>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{e.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{e.event.eventName}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-bold text-gray-900 text-base">${Number(e.amountUsd).toFixed(2)}</p>
                    <Badge variant={STATUS_BADGE[e.status] ?? 'gray'}>{e.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-50">
                  {e.status === 'SUBMITTED' && (
                    <>
                      <button type="button" disabled={acting === e.id} onClick={() => approve(e.id)}
                        className="rounded-xl bg-green-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 min-h-[44px] flex-1">
                        {acting === e.id ? '…' : 'Approve'}
                      </button>
                      <button type="button" onClick={() => { setRejectId(e.id); setRejectNote(''); setRejectErr('') }}
                        className="rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-2.5 text-sm font-medium hover:bg-red-100 min-h-[44px] flex-1">
                        Reject
                      </button>
                    </>
                  )}
                  <Link href={`/manager/approvals/expense/${e.id}`}
                    className="text-xs font-medium text-indigo-600 hover:underline px-1 py-2 min-h-[44px] flex items-center">
                    View details →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden sm:block rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
            <table className="w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
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
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{e.employee.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{e.employee.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                      <p className="truncate">{e.description}</p>
                      {e.merchantName && <p className="text-xs text-gray-400 truncate">{e.merchantName}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{e.category.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[150px]">
                      <p className="truncate">{e.event.eventName}</p>
                      <p className="text-gray-400 font-mono">{e.event.eventCode}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">${Number(e.amountUsd).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[e.status] ?? 'gray'}>{e.status.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {e.status === 'SUBMITTED' && (
                          <>
                            <button type="button" disabled={acting === e.id} onClick={() => approve(e.id)}
                              className="rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
                              {acting === e.id ? '…' : 'Approve'}
                            </button>
                            <button type="button" onClick={() => { setRejectId(e.id); setRejectNote(''); setRejectErr('') }}
                              className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-100 whitespace-nowrap">
                              Reject
                            </button>
                          </>
                        )}
                        <Link href={`/manager/approvals/expense/${e.id}`}
                          className="text-xs font-medium text-indigo-600 hover:underline whitespace-nowrap">
                          View →
                        </Link>
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
