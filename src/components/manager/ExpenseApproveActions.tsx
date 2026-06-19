'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Mode = 'idle' | 'approving' | 'rejecting'

export function ExpenseApproveActions({ expenseId }: { expenseId: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('idle')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function cancel() { setMode('idle'); setNote(''); setError('') }

  async function decide(status: 'APPROVED' | 'REJECTED') {
    if (status === 'REJECTED' && !note.trim()) { setError('Reason required'); return }
    setBusy(true)
    setError('')
    const res = await fetch(`/api/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        ...(note.trim() ? { rejectionNote: note.trim() } : {}),
      }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Failed')
      setBusy(false)
    }
  }

  if (mode === 'approving') {
    return (
      <div className="flex flex-col gap-1.5 items-end">
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note…"
          className="w-44 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-300"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => decide('APPROVED')} disabled={busy}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            {busy ? '…' : 'Confirm approve'}
          </button>
          <button type="button" onClick={cancel}
            className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
            Cancel
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    )
  }

  if (mode === 'rejecting') {
    return (
      <div className="flex flex-col gap-1.5 items-end">
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason for rejection…"
          className="w-44 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => decide('REJECTED')} disabled={busy}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy ? '…' : 'Confirm reject'}
          </button>
          <button type="button" onClick={cancel}
            className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
            Cancel
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setMode('approving')}
        className="min-h-[2.25rem] rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => setMode('rejecting')}
        className="min-h-[2.25rem] rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
      >
        Reject
      </button>
    </div>
  )
}
