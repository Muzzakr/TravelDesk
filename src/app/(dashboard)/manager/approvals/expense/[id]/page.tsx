'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

function ReceiptRow({ id, fileName }: { id: string; fileName: string }) {
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState<string | null>(null)

  async function loadUrl() {
    setLoading(true)
    const res = await fetch(`/api/receipts/${id}/url`)
    if (res.ok) {
      const data = await res.json()
      setUrl(data.url)
    }
    setLoading(false)
  }

  const isPdf = fileName.toLowerCase().endsWith('.pdf')

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg">{isPdf ? '📄' : '🖼️'}</span>
        <span className="truncate text-gray-700">{fileName}</span>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-3 shrink-0 text-indigo-600 font-medium hover:underline"
        >
          Open receipt →
        </a>
      ) : (
        <button
          type="button"
          onClick={loadUrl}
          disabled={loading}
          className="ml-3 shrink-0 text-indigo-600 font-medium hover:underline disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'View receipt →'}
        </button>
      )}
    </div>
  )
}

export default function ApproveExpensePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [expense, setExpense] = useState<Record<string, unknown> | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const r = await fetch(`/api/expenses/${id}`)
      if (r.ok) setExpense(await r.json())
    }
    load()
  }, [id])

  async function handle(status: 'APPROVED' | 'REJECTED') {
    if (status === 'REJECTED' && !note.trim()) {
      setError('A note is required when rejecting.')
      return
    }
    setLoading(true)
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectionNote: status === 'REJECTED' ? note : undefined }),
    })
    if (res.ok) {
      router.push('/manager')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed')
      setLoading(false)
    }
  }

  if (!expense) return <div className="p-8 text-gray-400">Loading…</div>

  const emp = expense.employee as { name: string; email: string }
  const ev = expense.event as { eventName: string; budgetUsd: number; approvedSpendUsd: number }
  const receipts = (expense.receipts as { id: string; fileName: string }[]) ?? []
  const eventBudget    = Number(ev.budgetUsd)
  const eventSpent     = Number(ev.approvedSpendUsd)
  const expenseAmt     = Number(expense.amountUsd ?? 0)
  const isAlreadyApproved = String(expense.status) === 'APPROVED'
  const projectedSpent = isAlreadyApproved ? eventSpent : eventSpent + expenseAmt
  const budgetPct      = eventBudget > 0 ? Math.min(Math.round((eventSpent / eventBudget) * 100), 100) : 0
  const projectedPct   = eventBudget > 0 ? Math.min(Math.round((projectedSpent / eventBudget) * 100), 100) : 0
  const budgetBarColor = projectedPct >= 100 ? 'bg-red-500' : projectedPct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
  const actions = (expense.approvalActions as { actionType: string; note?: string; createdAt: string; actor: { name: string } }[]) ?? []
  const status = String(expense.status)
  const isDecided = ['APPROVED', 'REJECTED', 'PAID'].includes(status)

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Review expense</h1>

      <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Employee</span><p className="font-medium text-gray-900">{emp.name}</p></div>
          <div><span className="text-gray-500">Event</span><p className="font-medium text-gray-900">{ev.eventName}</p></div>
          <div><span className="text-gray-500">Description</span><p className="font-medium text-gray-900">{String(expense.description)}</p></div>
          <div><span className="text-gray-500">Category</span><p className="font-medium text-gray-900">{String(expense.category)}</p></div>
          <div><span className="text-gray-500">Amount</span><p className="text-xl font-bold text-gray-900">${Number(expense.amountUsd).toFixed(2)}</p></div>
          <div><span className="text-gray-500">Status</span><p><Badge variant={statusToBadgeVariant(status)}>{status}</Badge></p></div>
        </div>

        {/* Event budget */}
        {eventBudget > 0 && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Event budget — {ev.eventName}</span>
              <span className={projectedPct >= 100 ? 'text-red-600' : projectedPct >= 80 ? 'text-yellow-600' : 'text-gray-500'}>
                {projectedPct}% {isAlreadyApproved ? 'used' : 'after approval'}
              </span>
            </div>
            <div className="relative h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              {/* eslint-disable-next-line react/forbid-component-props */}
              <div className="absolute inset-y-0 left-0 bg-gray-300 rounded-full" style={{ width: `${budgetPct}%` }} />
              {/* eslint-disable-next-line react/forbid-component-props */}
              <div className={`absolute inset-y-0 left-0 rounded-full ${budgetBarColor}`} style={{ width: `${projectedPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Spent: <span className="font-medium text-gray-800">${eventSpent.toLocaleString('en-US')}</span></span>
              {!isAlreadyApproved && expenseAmt > 0 && (
                <span>+ This expense: <span className="font-medium text-indigo-700">${expenseAmt.toLocaleString('en-US')}</span></span>
              )}
              <span>Budget: <span className="font-medium text-gray-800">${eventBudget.toLocaleString('en-US')}</span></span>
            </div>
          </div>
        )}

        {/* Receipts */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Receipts</p>
          {receipts.length === 0 ? (
            <p className="text-sm text-gray-400">No receipt attached.</p>
          ) : (
            <div className="space-y-2">
              {receipts.map((r) => (
                <ReceiptRow key={r.id} id={r.id} fileName={r.fileName} />
              ))}
            </div>
          )}
        </div>

        {/* Approval history */}
        {actions.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">History</p>
            <div className="space-y-2">
              {actions.map((a, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    a.actionType === 'APPROVE' ? 'bg-green-100 text-green-700' :
                    a.actionType === 'REJECT' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{a.actionType}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900">{a.actor.name}</span>
                    {a.note && <p className="text-gray-500 mt-0.5 text-xs">{a.note}</p>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{new Date(a.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isDecided && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Note (required for rejection)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Add a note…"
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <Button onClick={() => handle('APPROVED')} loading={loading}>Approve</Button>
              <Button variant="danger" onClick={() => handle('REJECTED')} loading={loading}>Reject</Button>
              <Button variant="secondary" onClick={() => router.back()}>Back</Button>
            </div>
          </>
        )}

        {isDecided && (
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => router.back()}>Back</Button>
          </div>
        )}
      </div>
    </div>
  )
}
