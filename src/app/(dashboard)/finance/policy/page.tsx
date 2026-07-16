'use client'

import { useEffect, useState } from 'react'
import { LoadError } from '@/components/ui/LoadError'

interface PolicyConfig {
  amountThreshold: number
  receiptMinimum: number
  budgetWarningPercent: number
  budgetBlockPercent: number
}

export default function PolicyPage() {
  const [config, setConfig] = useState<PolicyConfig>({
    amountThreshold: 500,
    receiptMinimum: 25,
    budgetWarningPercent: 80,
    budgetBlockPercent: 100,
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setLoadError(false)
    fetch('/api/finance/policy')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => setConfig(d))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSuccess('')
    setError('')
    const res = await fetch('/api/finance/policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    if (res.ok) {
      setSuccess('Policy limits saved.')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Loading...</div>
  if (loadError) return <div className="max-w-2xl"><LoadError onRetry={load} /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Policy limits</h1>
      <p className="text-sm text-gray-500">Configure approval thresholds and budget caps. Changes apply immediately to all new submissions.</p>

      {success && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSave} className="space-y-5">

        <div className="rounded-xl border bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Expense rules</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Finance Admin approval required above ($)
            </label>
            <input
              type="number"
              min={1}
              value={config.amountThreshold}
              onChange={(e) => setConfig({ ...config, amountThreshold: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-400">Expenses above this amount require Finance Admin approval. Default: $500</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Receipt required above ($)
            </label>
            <input
              type="number"
              min={1}
              value={config.receiptMinimum}
              onChange={(e) => setConfig({ ...config, receiptMinimum: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-400">Expenses at or above this amount must have a receipt. Default: $25</p>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Event budget caps</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Warning threshold (%)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.budgetWarningPercent}
              onChange={(e) => setConfig({ ...config, budgetWarningPercent: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-400">Show warning when event budget reaches this %. Default: 80%</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Block threshold (%)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.budgetBlockPercent}
              onChange={(e) => setConfig({ ...config, budgetBlockPercent: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-400">Block new expenses and require Finance Admin when budget reaches this %. Default: 100%</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save policy'}
          </button>
        </div>
      </form>
    </div>
  )
}
