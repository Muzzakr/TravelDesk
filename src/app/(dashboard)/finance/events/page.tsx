'use client'

import { useState, useEffect } from 'react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { FileUpload } from '@/components/ui/FileUpload'

type Event = {
  id: string
  eventCode: string
  eventName: string
  status: string
  eventDate: string | null
  budgetUsd: number
  approvedSpendUsd: number
}

type DocRow = {
  id: string
  fileName: string
  mimeType: string
  uploadedAt: string
  uploader: { name: string }
}

export default function FinanceEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  // budget edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // documents modal
  const [docsModal, setDocsModal] = useState<Event | null>(null)
  const [docs, setDocs] = useState<DocRow[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [loadingDocUrl, setLoadingDocUrl] = useState<Record<string, boolean>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [docCounts, setDocCounts] = useState<Record<string, number>>({})

  async function load() {
    const res = await fetch('/api/events')
    if (res.ok) setEvents(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filteredEvents = events.filter(
    (ev) =>
      !query ||
      ev.eventName.toLowerCase().includes(query.toLowerCase()) ||
      ev.eventCode.toLowerCase().includes(query.toLowerCase())
  )

  function startEdit(ev: Event) {
    setEditingId(ev.id)
    setBudgetInput(Number(ev.budgetUsd).toFixed(2))
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setBudgetInput('')
    setError('')
  }

  async function saveBudget(id: string) {
    const val = parseFloat(budgetInput)
    if (isNaN(val) || val < 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budgetUsd: val }),
    })
    if (res.ok) {
      await load()
      setEditingId(null)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  async function openDocsModal(ev: Event) {
    setDocsModal(ev)
    setDocs([])
    setDocUrls({})
    setUploadError('')
    setDocsLoading(true)
    const res = await fetch(`/api/events/${ev.id}/documents`)
    if (res.ok) setDocs(await res.json())
    setDocsLoading(false)
  }

  function closeDocsModal() {
    // update count badge
    setDocCounts((prev) => ({ ...prev, [docsModal!.id]: docs.length }))
    setDocsModal(null)
  }

  async function loadDocUrl(docId: string) {
    if (docUrls[docId]) {
      window.open(docUrls[docId], '_blank')
      return
    }
    setLoadingDocUrl((prev) => ({ ...prev, [docId]: true }))
    const res = await fetch(`/api/events/${docsModal!.id}/documents/${docId}`)
    if (res.ok) {
      const { url } = await res.json()
      setDocUrls((prev) => ({ ...prev, [docId]: url }))
      window.open(url, '_blank')
    }
    setLoadingDocUrl((prev) => ({ ...prev, [docId]: false }))
  }

  async function handleDocUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large — maximum size is 10 MB.')
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/events/${docsModal!.id}/documents`, { method: 'POST', body: fd })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setUploadError(d.error ?? `Upload failed (${res.status})`)
      } else {
        const res2 = await fetch(`/api/events/${docsModal!.id}/documents`)
        if (res2.ok) setDocs(await res2.json())
      }
    } catch {
      setUploadError('Network error — please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Events &amp; Budgets</h1>

      {/* Search */}
      <input
        type="search"
        placeholder="Search by event name or code…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
      />

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          {query ? 'No events match your search.' : 'No events found.'}
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {filteredEvents.map((ev) => {
              const budget = Number(ev.budgetUsd)
              const spent = Number(ev.approvedSpendUsd)
              const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
              const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
              const isEditing = editingId === ev.id
              return (
                <div key={ev.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{ev.eventName}</p>
                      <p className="text-xs font-mono text-gray-400">{ev.eventCode}</p>
                    </div>
                    <Badge variant={statusToBadgeVariant(ev.status)}>{ev.status}</Badge>
                  </div>
                  {ev.eventDate && (
                    <p className="text-xs text-gray-400">{new Date(ev.eventDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Spent: <span className="font-medium text-gray-800">${spent.toFixed(0)}</span></span>
                      <span>Budget: <span className="font-medium text-gray-800">${budget.toFixed(0)}</span> ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-500">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          title="Budget amount"
                          placeholder="0.00"
                          value={budgetInput}
                          onChange={(e) => setBudgetInput(e.target.value)}
                          className="w-28 rounded border border-indigo-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button type="button" onClick={() => saveBudget(ev.id)} disabled={saving}
                          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" onClick={cancelEdit} className="text-xs text-gray-400 hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => startEdit(ev)} className="text-xs font-medium text-indigo-600 hover:underline">
                        Edit budget
                      </button>
                    )}
                    <button type="button" onClick={() => openDocsModal(ev)} className="text-xs font-medium text-gray-500 hover:text-indigo-600 hover:underline">
                      Documents{docCounts[ev.id] ? ` (${docCounts[ev.id]})` : ''}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[750px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Event Name</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Budget (USD)</th>
                  <th className="px-4 py-3 text-right">Spent</th>
                  <th className="px-4 py-3 text-left w-48">Usage</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredEvents.map((ev) => {
                  const budget = Number(ev.budgetUsd)
                  const spent = Number(ev.approvedSpendUsd)
                  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
                  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                  const isEditing = editingId === ev.id
                  return (
                    <tr key={ev.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{ev.eventCode}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{ev.eventName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusToBadgeVariant(ev.status)}>{ev.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {isEditing ? (
                          <input
                            type="number" min="0" step="0.01"
                            value={budgetInput}
                            onChange={(e) => setBudgetInput(e.target.value)}
                            className="w-28 rounded border border-indigo-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            autoFocus
                          />
                        ) : (
                          `$${budget.toFixed(0)}`
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">${spent.toFixed(0)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-gray-100">
                            <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => saveBudget(ev.id)} disabled={saving}
                                className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                              <button type="button" onClick={cancelEdit} className="text-xs text-gray-400 hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => startEdit(ev)} className="text-xs font-medium text-indigo-600 hover:underline">
                              Edit budget
                            </button>
                          )}
                          <button type="button" onClick={() => openDocsModal(ev)}
                            className="text-xs font-medium text-gray-500 hover:text-indigo-600 hover:underline">
                            Documents{docCounts[ev.id] ? ` (${docCounts[ev.id]})` : ''}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Documents modal */}
      {docsModal && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/40" onClick={closeDocsModal} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="pointer-events-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Documents</h2>
                  <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{docsModal.eventName}</p>
                </div>
                <button type="button" onClick={closeDocsModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>

              {/* Document list */}
              <div className="px-6 py-4 space-y-3 max-h-64 overflow-y-auto">
                {docsLoading ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : docs.length === 0 ? (
                  <p className="text-sm text-gray-400">No documents uploaded yet.</p>
                ) : (
                  docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {doc.uploader.name} · {new Date(doc.uploadedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadDocUrl(doc.id)}
                        disabled={loadingDocUrl[doc.id]}
                        className="ml-3 shrink-0 text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                      >
                        {loadingDocUrl[doc.id] ? 'Opening…' : 'Open →'}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Upload area */}
              <div className="border-t px-6 py-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Upload document</p>
                <FileUpload
                  label={uploading ? 'Uploading…' : 'Click or drag file here'}
                  hint="PDF, JPG, PNG, XLSX, CSV — max 10 MB"
                  accept="image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  disabled={uploading}
                  onFile={handleDocUpload}
                />
                {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
