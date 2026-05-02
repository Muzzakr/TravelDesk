'use client'

import { useState, useEffect } from 'react'

export function WebhookCard() {
  const [masked, setMasked] = useState<string | null>(null)
  const [hasKey, setHasKey] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/admin/webhook-key').then(async (r) => {
      if (!r.ok) return
      try {
        const d = await r.json() as { masked: string | null; hasKey: boolean }
        setMasked(d.masked)
        setHasKey(d.hasKey)
      } catch { /* not ready */ }
    })
  }, [])

  async function regenerate() {
    setRegenerating(true)
    setConfirming(false)
    const res = await fetch('/api/admin/webhook-key/regenerate', { method: 'POST' })
    if (res.ok) {
      const d = await res.json() as { key: string }
      setNewKey(d.key)
      setMasked(`••••••••••••${d.key.slice(-8)}`)
      setHasKey(true)
    }
    setRegenerating(false)
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exampleCurl = `curl -X POST https://your-domain.com/api/webhooks/events \\
  -H "X-Api-Key: <your-key>" \\
  -H "Content-Type: application/json" \\
  -d '[{"eventCode":"EVT-001","eventName":"Summer Gala","venue":"Grand Hotel","eventDate":"2026-08-15","status":"DRAFT"}]'`

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-gray-800">Webhook / API integration</h2>
      <div className="rounded-xl border bg-white p-6 space-y-5">
        <p className="text-sm text-gray-600">
          Use this API key to push events from external tools like Zapier. Send a <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">POST</code> request with the key in the <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">X-Api-Key</code> header.
        </p>

        {/* Key display */}
        <div className="flex items-center gap-3 flex-wrap">
          <code className="flex-1 min-w-0 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm font-mono text-gray-700 truncate">
            {newKey ?? masked ?? (hasKey ? '••••••••••••••••' : 'No key generated yet')}
          </code>
          {(newKey ?? masked) && (
            <button
              type="button"
              onClick={() => copy(newKey ?? masked ?? '')}
              className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
        </div>

        {newKey && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 font-medium">
            ⚠ Copy this key now — it will not be shown again in full.
          </p>
        )}

        {/* Regenerate */}
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            {hasKey ? 'Regenerate key' : 'Generate key'}
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-red-700 font-medium">The old key will stop working immediately. Continue?</p>
            <button
              type="button"
              onClick={regenerate}
              disabled={regenerating}
              className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {regenerating ? 'Generating…' : 'Yes, regenerate'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Example */}
        <div>
          <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Example request</p>
          <pre className="overflow-x-auto rounded-lg bg-gray-900 px-4 py-3 text-xs text-gray-200 leading-relaxed whitespace-pre-wrap break-all">
            {exampleCurl}
          </pre>
        </div>
      </div>
    </section>
  )
}
