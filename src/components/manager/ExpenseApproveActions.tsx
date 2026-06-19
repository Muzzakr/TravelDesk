'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Inline approve / reject for a pending expense, usable straight from a list.
// Calls the same PATCH /api/expenses/[id] the approval page uses, then refreshes
// the server-rendered list.
export function ExpenseApproveActions({ expenseId }: { expenseId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  async function decide(status: 'APPROVED' | 'REJECTED') {
    if (status === 'REJECTED' && !note.trim()) { setError('Reason required'); return }
    setBusy(true)
    setError('')
    const res = await fetch(`/api/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...(status === 'REJECTED' ? { rejectionNote: note } : {}) }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Failed')
      setBusy(false)
    }
  }

  if (rejecting) {
    return (
      <div className="flex flex-col items-end gap-1">
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason…"
          className="w-44 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <div className="flex gap-3">
          <button type="button" onClick={() => decide('REJECTED')} disabled={busy} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
            {busy ? '…' : 'Confirm reject'}
          </button>
          <button type="button" onClick={() => { setRejecting(false); setNote(''); setError('') }} className="text-xs text-gray-400 hover:underline">
            Cancel
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => decide('APPROVED')}
          disabled={busy}
          className="min-h-[2.25rem] rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? '…' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={() => setRejecting(true)}
          disabled={busy}
          className="min-h-[2.25rem] rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  )
}
