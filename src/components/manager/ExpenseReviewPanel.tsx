'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2, HelpCircle } from 'lucide-react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

export type ReviewExpense = {
  id: string
  category: string
  description: string
  amountUsd: number
  status: string
  rejectionNote: string | null
  adminEscalationNote: string | null
  reason: string | null
  personName: string | null
}

type Decision = 'APPROVED' | 'REJECTED' | 'PENDING_ADMIN' | null

const CATEGORY_LABELS: Record<string, string> = {
  MEALS: 'Meals',
  TRANSPORT: 'Transport',
  ACCOMMODATION: 'Accommodation',
  SUPPLIES: 'Supplies',
  OTHER: 'Other',
}

const PENDING = new Set(['SUBMITTED', 'UNDER_REVIEW', 'PENDING_ADMIN'])

export function ExpenseReviewPanel({
  expenses,
  currentExpenseId,
  canEscalate,
}: {
  expenses: ReviewExpense[]
  currentExpenseId: string
  canEscalate: boolean
}) {
  const router = useRouter()

  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(expenses.map((e) => [e.id, null]))
  )
  const [note, setNote] = useState('')
  const [escalationNote, setEscalationNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pendingExpenses = expenses.filter((e) => PENDING.has(e.status))
  const decidedExpenses = expenses.filter((e) => !PENDING.has(e.status))
  const hasRejections = pendingExpenses.some((e) => decisions[e.id] === 'REJECTED')
  const hasEscalations = pendingExpenses.some((e) => decisions[e.id] === 'PENDING_ADMIN')
  const hasAnyDecision = pendingExpenses.some((e) => decisions[e.id] !== null)

  function toggle(id: string, val: Exclude<Decision, null>) {
    setDecisions((prev) => ({ ...prev, [id]: prev[id] === val ? null : val }))
    setError('')
  }

  async function submit() {
    if (hasRejections && !note.trim()) {
      setError('A rejection reason is required when rejecting expenses.')
      return
    }
    if (hasEscalations && !escalationNote.trim()) {
      setError('Explain why you need admin input before asking.')
      return
    }
    const toUpdate = pendingExpenses.filter((e) => decisions[e.id] !== null)
    if (!toUpdate.length) return
    setBusy(true)
    setError('')
    try {
      for (const e of toUpdate) {
        const decision = decisions[e.id]!
        const res = await fetch(`/api/expenses/${e.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: decision,
            ...(decision === 'REJECTED' ? { rejectionNote: note.trim() } : {}),
            ...(decision === 'PENDING_ADMIN' ? { adminEscalationNote: escalationNote.trim() } : {}),
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(typeof d.error === 'string' ? d.error : 'Failed to save decision')
        }
      }
      router.push('/finance/expenses')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Review expenses for this event</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {pendingExpenses.length} pending · {decidedExpenses.length} already decided
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Pending — interactive */}
        {pendingExpenses.length === 0 && (
          <p className="px-5 py-6 text-sm text-center text-gray-400">
            No pending expenses for this event.
          </p>
        )}
        {pendingExpenses.map((e) => {
          const isCurrent = e.id === currentExpenseId
          const decision = decisions[e.id]
          const isEscalated = e.status === 'PENDING_ADMIN'
          return (
            <div
              key={e.id}
              className={`px-5 py-4 space-y-3 transition-colors ${
                isCurrent ? 'bg-indigo-50/60 ring-1 ring-inset ring-indigo-100' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {CATEGORY_LABELS[e.category] ?? e.category}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        Current
                      </span>
                    )}
                    {isEscalated && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <HelpCircle className="h-2.5 w-2.5" /> Asked Admin
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-gray-900 truncate">{e.description}</p>
                  {e.reason && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{e.reason}</p>
                  )}
                  {isEscalated && e.adminEscalationNote && (
                    <p className="text-xs text-amber-700 mt-1 italic">&ldquo;{e.adminEscalationNote}&rdquo;</p>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-900 whitespace-nowrap shrink-0 mt-0.5">
                  ${e.amountUsd.toFixed(2)}
                </p>
              </div>

              {/* Approve / Reject / Ask Admin toggle */}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => toggle(e.id, 'APPROVED')}
                  disabled={busy}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-100 ${
                    decision === 'APPROVED'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'border border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700'
                  } disabled:opacity-50`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => toggle(e.id, 'REJECTED')}
                  disabled={busy}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-100 ${
                    decision === 'REJECTED'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'border border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
                  } disabled:opacity-50`}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
                {canEscalate && (
                  <button
                    type="button"
                    onClick={() => toggle(e.id, 'PENDING_ADMIN')}
                    disabled={busy}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-100 ${
                      decision === 'PENDING_ADMIN'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'border border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'
                    } disabled:opacity-50`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Ask Admin
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Already-decided — read-only */}
        {decidedExpenses.length > 0 && (
          <div className="px-5 py-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Already decided
            </p>
            {decidedExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {CATEGORY_LABELS[e.category] ?? e.category}
                  </p>
                  <p className="text-sm text-gray-700 truncate">{e.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-gray-500">
                    ${e.amountUsd.toFixed(2)}
                  </span>
                  <Badge variant={statusToBadgeVariant(e.status)}>
                    {e.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rejection note */}
      {hasRejections && (
        <div className="border-t border-gray-100 px-5 py-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Rejection reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => { setNote(e.target.value); setError('') }}
            rows={3}
            placeholder="Why are these expenses being rejected?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
          />
        </div>
      )}

      {/* Ask Admin note */}
      {hasEscalations && (
        <div className="border-t border-gray-100 px-5 py-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Why do you need admin input? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={escalationNote}
            onChange={(e) => { setEscalationNote(e.target.value); setError('') }}
            rows={3}
            placeholder="What's unclear or trivial about these expenses?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100 resize-none"
          />
        </div>
      )}

      {error && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Submit — hidden when nothing is pending (already approved/paid) */}
      {pendingExpenses.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-4">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !hasAnyDecision}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Saving…' : 'Submit decisions'}
          </button>
          {!hasAnyDecision && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Select approve, reject{canEscalate ? ', or ask admin' : ''} for at least one expense
            </p>
          )}
        </div>
      )}
    </div>
  )
}
