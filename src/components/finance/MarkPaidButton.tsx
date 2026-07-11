'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MarkPaidButton({ expenseId }: { expenseId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function markPaid() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/finance/expenses/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(typeof d.error === 'string' ? d.error : '')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not mark the expense as paid. Try again.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={markPaid}
        disabled={busy}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Saving…' : 'Mark as Paid'}
      </button>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
