'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadError } from '@/components/ui/LoadError'

type PayoutExpense = {
  id: string
  amountUsd: number
  category: string
  description: string
  merchantName: string | null
  transactionDate: string | null
  eventName: string
  eventCode: string
}

type Person = {
  employeeId: string
  name: string
  count: number
  totalUsd: number
  paidThisMonthUsd: number
  expenses: PayoutExpense[]
}

type PageData = { people: Person[]; totalOutstandingUsd: number }

const fmtUsd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

export default function PayoutsPage() {
  const router = useRouter()
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [confirmFor, setConfirmFor] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    setLoadError(false)
    try {
      const res = await fetch('/api/payout-reports')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function markPersonPaid(person: Person) {
    setPayingId(person.employeeId)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/payout-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: person.employeeId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(typeof d.error === 'string' ? d.error : '')
      }
      setSuccess(`Paid ${fmtUsd(person.totalUsd)} to ${person.name} (${person.count} expense${person.count > 1 ? 's' : ''}).`)
      await load()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not mark the payout as paid. Try again.')
    }
    setPayingId(null)
    setConfirmFor(null)
  }

  function exportCSV() {
    if (!data?.people.length) return
    const rows = data.people.map((p) => [
      p.name, String(p.count), p.totalUsd.toFixed(2), p.paidThisMonthUsd.toFixed(2),
    ])
    const header = ['Employee', 'Approved Expenses', 'Total To Pay (USD)', 'Paid This Month (USD)']
    const csv = [header, ...rows].map((r) => r.map((v) => JSON.stringify(v ?? '')).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `payouts-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const people = data?.people ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Approved expenses awaiting payout, per person</p>
        </div>
        {people.length > 0 && (
          <button type="button" onClick={exportCSV}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Export CSV
          </button>
        )}
      </div>

      {/* Summary */}
      {data && !loadError && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <p className="text-xl font-bold text-indigo-700">{fmtUsd(data.totalOutstandingUsd)}</p>
            <p className="text-xs text-gray-500">Total to pay out</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
            <p className="text-xl font-bold text-gray-900">{people.length}</p>
            <p className="text-xs text-gray-500">{people.length === 1 ? 'Person' : 'People'} awaiting payout</p>
          </div>
        </div>
      )}

      {success && <p className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{success}</p>}
      {error && <p className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : loadError ? (
        <LoadError onRetry={load} />
      ) : people.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
          Nothing to pay out — all approved expenses are settled.
        </div>
      ) : (
        <div className="space-y-3">
          {people.map((p) => {
            const isOpen = !!expanded[p.employeeId]
            const isConfirming = confirmFor === p.employeeId
            const isPaying = payingId === p.employeeId
            return (
              <div key={p.employeeId} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                {/* Person row */}
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => toggleExpand(p.employeeId)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                      {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {p.count} approved expense{p.count > 1 ? 's' : ''}
                        {p.paidThisMonthUsd > 0 && <> · paid this month {fmtUsd(p.paidThisMonthUsd)}</>}
                      </p>
                    </div>
                    <svg className={`ml-1 h-4 w-4 shrink-0 text-gray-300 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-3 ml-auto">
                    <p className="text-lg font-bold text-gray-900 whitespace-nowrap">{fmtUsd(p.totalUsd)}</p>
                    {isConfirming ? (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => markPersonPaid(p)} disabled={isPaying}
                          className="rounded-lg bg-green-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
                          {isPaying ? 'Paying…' : `Confirm ${fmtUsd(p.totalUsd)}`}
                        </button>
                        <button type="button" onClick={() => setConfirmFor(null)} disabled={isPaying}
                          className="rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setConfirmFor(p.employeeId); setSuccess(''); setError('') }}
                        className="rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap">
                        Mark all as paid
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded expense list */}
                {isOpen && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {p.expenses.map((e) => (
                      <div key={e.id}
                        onClick={() => router.push(`/manager/approvals/expense/${e.id}`)}
                        className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 sm:px-5 hover:bg-gray-50">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">{e.description}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {e.category.replace(/_/g, ' ')}{e.merchantName ? ` · ${e.merchantName}` : ''} · {e.eventCode || e.eventName} · {fmtDate(e.transactionDate)}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-800">{fmtUsd(e.amountUsd)}</span>
                          <svg className="h-3.5 w-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
