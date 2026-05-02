'use client'

import { useState } from 'react'

export function EscalateButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/finance/escalate', { method: 'POST' })
    const d = await res.json()
    if (res.ok) {
      setResult(d.escalated === 0 ? 'No stale requests found.' : `Escalated ${d.escalated} request(s).`)
    } else {
      setResult(d.error ?? 'Failed to run escalation.')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-sm text-gray-500">{result}</span>}
      <button
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
      >
        {loading ? 'Running…' : 'Run 72h escalation'}
      </button>
    </div>
  )
}
