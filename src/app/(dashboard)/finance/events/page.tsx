'use client'

import { useState, useEffect } from 'react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { FileUpload } from '@/components/ui/FileUpload'
import { useModalDismiss } from '@/lib/use-modal-dismiss'

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

type ParsedEventRow = {
  rowNum: number
  eventCode: string
  eventName: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  venue?: string
  address?: string
  eventDate?: string
  timing?: string
  assignedDj?: string
  assignedMc?: string
  salesPerson?: string
}

type ImportPreview = {
  toCreate: ParsedEventRow[]
  duplicates: { incoming: ParsedEventRow; existing: { eventCode: string; eventName: string; status: string; eventDate: string | null; venue: string | null } }[]
  errors: string[]
}

const EVENTS_CSV_TEMPLATE = [
  'Event Code,Event Name,Status,Venue,Date,Timing,Assigned DJ,Assigned MC,Sales Person',
  'EVT-101,Q1 Kickoff,ACTIVE,Grand Hall,2026-11-15,6:00 PM - 11:00 PM,DJ Mike,Sarah K,John D',
  'EVT-102,Spring Gala,DRAFT,,2026-12-01,,,,',
].join('\n')

export default function FinanceEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')

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

  // import modal
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [committing, setCommitting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  async function load() {
    const [eventsRes, sessionRes] = await Promise.all([
      fetch('/api/events'),
      fetch('/api/auth/session'),
    ])
    if (eventsRes.ok) setEvents(await eventsRes.json())
    const session = await sessionRes.json().catch(() => null)
    setIsSystemAdmin(session?.user?.role === 'SYSTEM_ADMIN')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openImportModal() {
    setImportFile(null)
    setPreview(null)
    setPreviewError('')
    setImportResult(null)
    setImportOpen(true)
  }

  function closeImportModal() {
    setImportOpen(false)
  }

  const importDismissRef = useModalDismiss<HTMLDivElement>(importOpen, closeImportModal)

  function downloadTemplate() {
    const blob = new Blob([EVENTS_CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'events-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(file: File) {
    setImportFile(file)
    setPreview(null)
    setPreviewError('')
    setPreviewing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/events/import/preview', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPreviewError(data.error ?? `Preview failed (${res.status})`)
      } else {
        setPreview(data)
      }
    } catch {
      setPreviewError('Network error — please try again.')
    } finally {
      setPreviewing(false)
    }
  }

  async function confirmImport() {
    if (!preview || preview.toCreate.length === 0) return
    setCommitting(true)
    try {
      const res = await fetch('/api/events/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: preview.toCreate }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setImportResult(data)
        setPreview(null)
        await load()
      } else {
        setPreviewError(data.error ?? `Import failed (${res.status})`)
      }
    } catch {
      setPreviewError('Network error — please try again.')
    } finally {
      setCommitting(false)
    }
  }

  const selectedEvent = events.find((ev) => ev.id === selectedId) ?? null

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

  const docsDismissRef = useModalDismiss<HTMLDivElement>(!!docsModal, closeDocsModal)

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Events &amp; Budgets</h1>
        {isSystemAdmin && (
          <button
            type="button"
            onClick={openImportModal}
            className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Import Events
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {/* Dropdown */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <select
          title="Select event"
          value={selectedId}
          onChange={(e) => { setSelectedId(e.target.value); setEditingId(null) }}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">Select an event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.eventCode} — {ev.eventName}</option>
          ))}
        </select>
      )}

      {/* Detail card */}
      {selectedEvent ? (() => {
        const ev = selectedEvent
        const budget = Number(ev.budgetUsd)
        const spent = Number(ev.approvedSpendUsd)
        const remaining = budget - spent
        const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
        const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
        const isEditing = editingId === ev.id
        return (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-gray-400 mb-0.5">{ev.eventCode}</p>
                <h2 className="text-lg font-semibold text-gray-900">{ev.eventName}</h2>
                {ev.eventDate && (
                  <p className="text-sm text-gray-400 mt-0.5">
                    {new Date(ev.eventDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                  </p>
                )}
              </div>
              <Badge variant={statusToBadgeVariant(ev.status)}>{ev.status}</Badge>
            </div>

            {/* KPI boxes */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-2.5 sm:p-4 min-w-0">
                <p className="text-xs text-gray-400 mb-1">Budget</p>
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-gray-500">$</span>
                    <input
                      type="number" min="0" step="0.01" autoFocus
                      title="Budget amount"
                      placeholder="0.00"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="w-full min-w-0 rounded border border-indigo-300 px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                ) : (
                  <p className="text-base sm:text-2xl font-bold text-gray-900 truncate">${budget.toLocaleString('en-US')}</p>
                )}
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-2.5 sm:p-4 min-w-0">
                <p className="text-xs text-gray-400 mb-1">Used</p>
                <p className="text-base sm:text-2xl font-bold text-gray-900 truncate">${spent.toLocaleString('en-US')}</p>
              </div>
              <div className={`rounded-xl border p-2.5 sm:p-4 min-w-0 ${remaining < 0 ? 'border-red-200 bg-red-50' : 'border-green-100 bg-green-50'}`}>
                <p className="text-xs text-gray-400 mb-1">Remaining</p>
                <p className={`text-base sm:text-2xl font-bold truncate ${remaining < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  ${Math.abs(remaining).toLocaleString('en-US')}
                </p>
              </div>
            </div>

            {/* Usage bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Usage</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-gray-100">
                <div className={`h-2.5 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              {isEditing ? (
                <>
                  <button type="button" onClick={() => saveBudget(ev.id)} disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save budget'}
                  </button>
                  <button type="button" onClick={cancelEdit} className="text-sm text-gray-400 hover:underline">Cancel</button>
                </>
              ) : (
                <button type="button" onClick={() => startEdit(ev)}
                  className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50">
                  Edit budget
                </button>
              )}
              <button type="button" onClick={() => openDocsModal(ev)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Documents{docCounts[ev.id] ? ` (${docCounts[ev.id]})` : ''}
              </button>
            </div>
          </div>
        )
      })() : !loading && (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
          Select an event above to view its budget details.
        </div>
      )}

      {/* Documents modal */}
      {docsModal && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/40" onClick={closeDocsModal} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <div
              ref={docsDismissRef}
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

      {/* Import Events modal */}
      {importOpen && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/40" onClick={closeImportModal} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <div
              ref={importDismissRef}
              className="pointer-events-auto flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
                <h2 className="text-base font-semibold text-gray-900">Import Events</h2>
                <button type="button" onClick={closeImportModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>

              <div className="overflow-y-auto px-6 py-4 space-y-5">
                {importResult ? (
                  /* ── Step 3: result summary ── */
                  <div className="space-y-4">
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <p className="text-sm font-semibold text-green-800">
                        {importResult.created} event{importResult.created === 1 ? '' : 's'} created
                      </p>
                      {importResult.skipped > 0 && (
                        <p className="mt-1 text-sm text-green-700">{importResult.skipped} skipped — see details below.</p>
                      )}
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 space-y-1">
                        {importResult.errors.map((e, i) => (
                          <p key={i} className="text-xs text-yellow-800">{e}</p>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={closeImportModal}
                      className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Done
                    </button>
                  </div>
                ) : preview ? (
                  /* ── Step 2: preview — review before committing ── */
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                        {preview.toCreate.length} new
                      </span>
                      {preview.duplicates.length > 0 && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600">
                          {preview.duplicates.length} already exist — will be skipped
                        </span>
                      )}
                      {preview.errors.length > 0 && (
                        <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
                          {preview.errors.length} row error{preview.errors.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    {preview.toCreate.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">New events to create</p>
                        <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100">
                          <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                              <tr>
                                <th className="px-3 py-2 font-medium">Code</th>
                                <th className="px-3 py-2 font-medium">Name</th>
                                <th className="px-3 py-2 font-medium">Status</th>
                                <th className="px-3 py-2 font-medium">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.toCreate.map((r) => (
                                <tr key={r.rowNum} className="border-t border-gray-100">
                                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.eventCode}</td>
                                  <td className="px-3 py-2 text-gray-900">{r.eventName}</td>
                                  <td className="px-3 py-2"><Badge variant={statusToBadgeVariant(r.status)}>{r.status}</Badge></td>
                                  <td className="px-3 py-2 text-gray-500">{r.eventDate ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {preview.duplicates.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Already exist (same Event Code) — will be skipped
                        </p>
                        <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-100">
                          <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                              <tr>
                                <th className="px-3 py-2 font-medium">Code</th>
                                <th className="px-3 py-2 font-medium">Incoming name</th>
                                <th className="px-3 py-2 font-medium">Existing name</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.duplicates.map((d) => (
                                <tr key={d.incoming.rowNum} className="border-t border-gray-100">
                                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{d.incoming.eventCode}</td>
                                  <td className="px-3 py-2 text-gray-500">{d.incoming.eventName}</td>
                                  <td className="px-3 py-2 text-gray-900">{d.existing.eventName}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {preview.errors.length > 0 && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1">
                        {preview.errors.map((e, i) => (
                          <p key={i} className="text-xs text-red-700">{e}</p>
                        ))}
                      </div>
                    )}

                    {previewError && <p className="text-sm text-red-600">{previewError}</p>}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={confirmImport}
                        disabled={preview.toCreate.length === 0 || committing}
                        className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {committing ? 'Importing…' : `Import ${preview.toCreate.length} event${preview.toCreate.length === 1 ? '' : 's'}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPreview(null); setImportFile(null) }}
                        disabled={committing}
                        className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Choose different file
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Step 1: format guide + file picker ── */
                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Required CSV format</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-gray-500">
                            <tr>
                              <th className="pb-1.5 pr-3 font-medium">Column</th>
                              <th className="pb-1.5 font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-600">
                            <tr><td className="py-0.5 pr-3 font-mono text-gray-900">Event Code *</td><td className="py-0.5">must be unique</td></tr>
                            <tr><td className="py-0.5 pr-3 font-mono text-gray-900">Event Name *</td><td className="py-0.5"></td></tr>
                            <tr><td className="py-0.5 pr-3 font-mono">Status</td><td className="py-0.5">DRAFT / ACTIVE / CLOSED — defaults to DRAFT</td></tr>
                            <tr><td className="py-0.5 pr-3 font-mono">Date</td><td className="py-0.5">YYYY-MM-DD preferred</td></tr>
                            <tr><td className="py-0.5 pr-3 font-mono">Venue, Address, Timing</td><td className="py-0.5">optional</td></tr>
                            <tr><td className="py-0.5 pr-3 font-mono">Assigned DJ, Assigned MC, Sales Person</td><td className="py-0.5">optional</td></tr>
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">* required. Budget and cost-center aren&apos;t set via import — add those after, on each event.</p>
                      <button type="button" onClick={downloadTemplate} className="mt-3 text-xs font-medium text-indigo-600 hover:underline">
                        Download CSV template →
                      </button>
                    </div>

                    <FileUpload
                      label={previewing ? 'Checking file…' : 'Click or drag CSV file here'}
                      hint="CSV only — max 10 MB"
                      accept="text/csv,.csv"
                      file={importFile}
                      disabled={previewing}
                      onFile={handleImportFile}
                      onClear={() => { setImportFile(null); setPreviewError('') }}
                    />
                    {previewError && <p className="text-sm text-red-600">{previewError}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
