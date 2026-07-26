'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import type { ExtractedEvent } from '@/app/api/events/extract/route'
import { Check } from 'lucide-react'
import { useModalDismiss } from '@/lib/use-modal-dismiss'
import { EventsCalendar } from '@/components/admin/events/EventsCalendar'
import { EventDetailDrawer } from '@/components/admin/events/EventDetailDrawer'
import type { EventRow } from '@/components/admin/events/types'

const EMPTY_FORM = {
  eventCode: '', eventName: '', venue: '', address: '',
  eventDate: '', timing: '', assignedDj: '', assignedMc: '',
  salesPerson: '', costCenter: '', budgetUsd: '', status: 'DRAFT',
}

function Field({
  label, value, onChange, required, invalid, type = 'text', isSelect,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  invalid?: boolean
  type?: string
  isSelect?: boolean
}) {
  const base = `w-full rounded-lg border px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
    invalid ? 'border-red-400 bg-red-50' : 'border-gray-300'
  }`
  if (isSelect)
    return (
      <div>
        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">{label}{required && ' *'}</label>
        <select title={label} value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="DRAFT">DRAFT</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="CLOSED">CLOSED</option>
        </select>
      </div>
    )
  if (type === 'date')
    return <DateInput label={`${label}${required ? ' *' : ''}`} title={label} value={value} onChange={onChange} className={base} />
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">{label}{required && ' *'}</label>
      <input
        type={type}
        title={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={base}
      />
    </div>
  )
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  // Drawer state
  const [selected, setSelected] = useState<EventRow | null>(null)

  // Edit modal state (separate from drawer — avoids all focus/z-index issues)
  const [editModal, setEditModal] = useState<EventRow | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Search / filter
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [creatorFilter, setCreatorFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Smart import state
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [preview, setPreview] = useState<ExtractedEvent[] | null>(null)
  const [previewFileName, setPreviewFileName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<{ created: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Escape-to-close + focus management for the edit modal (the drawer handles its own)
  const editDismissRef = useModalDismiss<HTMLDivElement>(!!editModal, () => setEditModal(null))

  function f(key: string, value: string) { setForm((p) => ({ ...p, [key]: value })) }

  async function loadEvents() {
    const res = await fetch('/api/events')
    if (res.ok) setEvents(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadEvents() }, [])

  function openDetail(ev: EventRow) {
    setSelected(ev)
    setShowForm(false)
  }

  function closeDrawer() {
    setSelected(null)
    setConfirmDelete(false)
  }

  function handleStatusChanged(updated: EventRow) {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setSelected(updated)
  }

  async function deleteEvent() {
    if (!selected) return
    setDeleting(true)
    const res = await fetch(`/api/events/${selected.id}`, { method: 'DELETE' })
    if (res.ok) {
      closeDrawer()
      loadEvents()
    } else {
      const d = await res.json()
      setEditError(d.error ?? 'Failed to delete event')
    }
    setDeleting(false)
    setConfirmDelete(false)
  }

  function openEditModal(ev: EventRow) {
    setEditForm({
      eventCode: ev.eventCode,
      eventName: ev.eventName,
      venue: ev.venue ?? '',
      address: ev.address ?? '',
      eventDate: ev.eventDate ? new Date(ev.eventDate).toISOString().split('T')[0] : '',
      timing: ev.timing ?? '',
      assignedDj: ev.assignedDj ?? '',
      assignedMc: ev.assignedMc ?? '',
      salesPerson: ev.salesPerson ?? '',
      costCenter: ev.costCenter ?? '',
      budgetUsd: ev.budgetUsd ? String(ev.budgetUsd) : '',
      status: ev.status,
    })
    setEditError('')
    setEditModal(ev)
  }

  function ef(key: string, value: string) { setEditForm((p) => ({ ...p, [key]: value })) }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditSaving(true)
    setEditError('')
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, budgetUsd: editForm.budgetUsd ? parseFloat(editForm.budgetUsd) : undefined }),
    })
    if (res.ok) {
      setEditModal(null)
      const fresh: EventRow[] = await fetch('/api/events').then((r) => r.json())
      setEvents(fresh)
      const updated = fresh.find((ev) => ev.eventCode === editForm.eventCode)
      if (updated) setSelected(updated)
    } else {
      const d = await res.json()
      setEditError(d.error ?? 'Failed to save event')
    }
    setEditSaving(false)
  }

  async function handleSmartImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setExtracting(true)
    setExtractError('')
    setPreview(null)
    setCreateResult(null)
    setPreviewFileName(file.name)

    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/events/extract', { method: 'POST', body: fd })
    const data = await res.json()

    if (!res.ok) {
      setExtractError(data.error ?? 'Could not read the file')
    } else {
      setPreview(data.events as ExtractedEvent[])
    }
    setExtracting(false)
    e.target.value = ''
  }

  function updatePreviewRow(index: number, field: keyof ExtractedEvent, value: string) {
    setPreview((prev) => {
      if (!prev) return prev
      return prev.map((ev, i) => {
        if (i !== index) return ev
        const newEv = { ...ev, [field]: value }
        const errors: string[] = []
        if (!newEv.eventCode.trim()) errors.push('Event Code is required')
        if (!newEv.eventName.trim()) errors.push('Event Name is required')
        if (newEv.eventDate && isNaN(Date.parse(newEv.eventDate))) errors.push('Date must be YYYY-MM-DD')
        return { ...newEv, errors }
      })
    })
  }

  function removePreviewRow(index: number) {
    setPreview((prev) => prev ? prev.filter((_, i) => i !== index) : prev)
  }

  async function createAllEvents() {
    if (!preview) return
    const valid = preview.filter((ev) => ev.errors.length === 0)
    if (valid.length === 0) return

    setCreating(true)
    const errors: string[] = []
    let created = 0

    for (const ev of valid) {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventCode: ev.eventCode, eventName: ev.eventName,
          venue: ev.venue || undefined, address: ev.address || undefined,
          eventDate: ev.eventDate || undefined, timing: ev.timing || undefined,
          assignedDj: ev.assignedDj || undefined, assignedMc: ev.assignedMc || undefined,
          salesPerson: ev.salesPerson || undefined, status: ev.status,
        }),
      })
      if (res.ok) {
        created++
      } else {
        let message = `HTTP ${res.status}`
        try { const d = await res.json(); message = d.error ?? message } catch { /* not JSON */ }
        errors.push(`"${ev.eventCode}" — ${message}`)
      }
    }

    setCreateResult({ created, errors })
    if (created > 0) {
      await loadEvents()
      if (errors.length === 0) {
        setTimeout(() => { setPreview(null); setCreateResult(null) }, 2500)
      }
    }
    setCreating(false)
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('')
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, budgetUsd: form.budgetUsd ? parseFloat(form.budgetUsd) : undefined }),
    })
    if (res.ok) {
      setShowForm(false); setForm(EMPTY_FORM)
      loadEvents()
    } else {
      const d = await res.json(); setFormError(d.error ?? 'Failed to save event')
    }
    setSaving(false)
  }

  const validCount = preview ? preview.filter((ev) => ev.errors.length === 0).length : 0
  const invalidCount = preview ? preview.filter((ev) => ev.errors.length > 0).length : 0

  const creators = Array.from(new Map(events.map((e) => [e.owner.id, e.owner])).values())

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setCreatorFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const filteredEvents = events.filter((ev) => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q ||
      ev.eventCode.toLowerCase().includes(q) ||
      ev.eventName.toLowerCase().includes(q) ||
      (ev.venue ?? '').toLowerCase().includes(q) ||
      (ev.owner?.name ?? '').toLowerCase().includes(q)

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && ev.status === 'ACTIVE') ||
      (statusFilter === 'inactive' && ev.status !== 'ACTIVE')

    const matchesCreator = creatorFilter === 'all' || ev.owner?.id === creatorFilter

    const evDateIso = ev.eventDate ? new Date(ev.eventDate).toISOString().slice(0, 10) : null
    const matchesFrom = !dateFrom || (!!evDateIso && evDateIso >= dateFrom)
    const matchesTo = !dateTo || (!!evDateIso && evDateIso <= dateTo)

    return matchesSearch && matchesStatus && matchesCreator && matchesFrom && matchesTo
  })

  const filtersActive = !!search || statusFilter !== 'all' || creatorFilter !== 'all' || !!dateFrom || !!dateTo

  return (
    <div className="space-y-6">

      {/* ── Right-side detail drawer ─────────────────────── */}
      {selected && (
        <EventDetailDrawer
          event={selected}
          onClose={closeDrawer}
          onEdit={() => openEditModal(selected)}
          onDelete={deleteEvent}
          deleting={deleting}
          confirmDelete={confirmDelete}
          onConfirmDeleteChange={setConfirmDelete}
          onStatusChanged={handleStatusChanged}
        />
      )}

      {/* ── Edit modal ────────────────────────────────── */}
      {editModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditModal(null) }}
        >
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setEditModal(null)} />
          <div ref={editDismissRef} className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl bg-white shadow-2xl flex flex-col max-h-[90dvh]">
            <form onSubmit={saveEdit} className="flex flex-col max-h-[90vh]">
              {/* Modal header */}
              <div className="flex items-start justify-between border-b px-6 py-4">
                <div>
                  <p className="font-mono text-xs text-gray-400">{editModal.eventCode}</p>
                  <h2 className="text-lg font-semibold text-gray-900">Edit event</h2>
                </div>
                <button type="button" aria-label="Close" onClick={() => setEditModal(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Event Code</label>
                    <input title="Event Code" value={editForm.eventCode} readOnly
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 cursor-not-allowed" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Status</label>
                    <select title="Status" value={editForm.status} onChange={(e) => ef('status', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Event Name <span className="text-red-500">*</span></label>
                  <input required title="Event Name" placeholder="Event Name" value={editForm.eventName} onChange={(e) => ef('eventName', e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Venue</label>
                    <input title="Venue" placeholder="Venue" value={editForm.venue} onChange={(e) => ef('venue', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Address</label>
                    <input title="Address" placeholder="Address" value={editForm.address} onChange={(e) => ef('address', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DateInput label="Date" title="Date" value={editForm.eventDate} onChange={(v) => ef('eventDate', v)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Timing</label>
                    <input title="Timing" placeholder="18:00 – 23:00" value={editForm.timing} onChange={(e) => ef('timing', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Assigned DJ</label>
                    <input title="Assigned DJ" placeholder="Assigned DJ" value={editForm.assignedDj} onChange={(e) => ef('assignedDj', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Assigned MC</label>
                    <input title="Assigned MC" placeholder="Assigned MC" value={editForm.assignedMc} onChange={(e) => ef('assignedMc', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Sales Person</label>
                    <input title="Sales Person" placeholder="Sales Person" value={editForm.salesPerson} onChange={(e) => ef('salesPerson', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Budget (USD)</label>
                    <input type="number" title="Budget (USD)" placeholder="0" value={editForm.budgetUsd} onChange={(e) => ef('budgetUsd', e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                  </div>
                </div>
                {editError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{editError}</p>}
              </div>

              {/* Modal footer */}
              <div className="border-t px-6 py-4 flex items-center gap-3">
                <Button type="submit" loading={editSaving}>Save changes</Button>
                <button type="button" onClick={() => setEditModal(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Preview panel ─────────────────────────────── */}
      {preview && (
        <div className="rounded-xl border border-indigo-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Preview — {previewFileName}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {validCount} event{validCount !== 1 ? 's' : ''} ready
                {invalidCount > 0 && <span className="text-red-500"> · {invalidCount} with errors</span>}
                {' '}<span className="text-gray-400">— existing event codes will be updated</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setPreview(null); setExtractError(''); setCreateResult(null) }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Discard
              </button>
              <Button onClick={createAllEvents} loading={creating} disabled={validCount === 0}>
                Create {validCount} event{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>

          {createResult && (
            <div className={`mx-6 mt-4 rounded-lg p-3 text-sm ${createResult.created > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {createResult.created > 0 && <p className="inline-flex items-center gap-1 font-medium"><Check className="w-4 h-4" /> {createResult.created} event{createResult.created !== 1 ? 's' : ''} created successfully.</p>}
              {createResult.errors.map((err, i) => <p key={i} className="mt-0.5 text-xs">{err}</p>)}
            </div>
          )}

          <div className="divide-y divide-gray-100 p-6 space-y-4">
            {preview.map((ev, i) => (
              <div key={i} className={`rounded-xl border p-4 ${ev.errors.length > 0 ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500">Event {i + 1}</span>
                  <div className="flex items-center gap-2">
                    {ev.errors.length > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                        {ev.errors.length} error{ev.errors.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {ev.errors.length === 0 && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Ready</span>
                    )}
                    <button type="button" onClick={() => removePreviewRow(i)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium">Remove</button>
                  </div>
                </div>
                {ev.errors.length > 0 && (
                  <ul className="mb-3 list-disc list-inside space-y-0.5">
                    {ev.errors.map((err, ei) => <li key={ei} className="text-xs text-red-600">{err}</li>)}
                  </ul>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <Field label="Event Code" value={ev.eventCode} required invalid={!ev.eventCode.trim()} onChange={(v) => updatePreviewRow(i, 'eventCode', v)} />
                  <Field label="Event Name" value={ev.eventName} required invalid={!ev.eventName.trim()} onChange={(v) => updatePreviewRow(i, 'eventName', v)} />
                  <Field label="Venue" value={ev.venue} onChange={(v) => updatePreviewRow(i, 'venue', v)} />
                  <Field label="Address" value={ev.address} onChange={(v) => updatePreviewRow(i, 'address', v)} />
                  <Field label="Date" value={ev.eventDate} type="date" invalid={!!ev.eventDate && isNaN(Date.parse(ev.eventDate))} onChange={(v) => updatePreviewRow(i, 'eventDate', v)} />
                  <Field label="Timing" value={ev.timing} onChange={(v) => updatePreviewRow(i, 'timing', v)} />
                  <Field label="Assigned DJ" value={ev.assignedDj} onChange={(v) => updatePreviewRow(i, 'assignedDj', v)} />
                  <Field label="Assigned MC" value={ev.assignedMc} onChange={(v) => updatePreviewRow(i, 'assignedMc', v)} />
                  <Field label="Sales Person" value={ev.salesPerson} onChange={(v) => updatePreviewRow(i, 'salesPerson', v)} />
                  <Field label="Status" value={ev.status} isSelect onChange={(v) => updatePreviewRow(i, 'status', v)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Event catalog</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.pdf" aria-label="Upload event file" className="hidden" onChange={handleSmartImport} />
          <button
            type="button"
            onClick={() => { setPreview(null); setExtractError(''); setCreateResult(null); fileInputRef.current?.click() }}
            disabled={extracting}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 sm:px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {extracting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Reading file…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                </svg>
                Upload file
              </>
            )}
          </button>
          <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New event'}</Button>
        </div>
      </div>

      {extractError && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Could not read file</p>
          <p className="mt-1">{extractError}</p>
        </div>
      )}

      {!preview && !extracting && (
        <p className="text-xs text-gray-400">
          Upload a <strong>CSV</strong>, <strong>Excel (.xlsx)</strong>, or <strong>PDF</strong> file — the system will automatically extract event data and show a preview for you to review and edit before saving.
        </p>
      )}

      {/* ── Search / filter ─────────────────────────────── */}
      {!showForm && !preview && events.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID, name, venue, or creator…"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              )}
            </div>
            <select
              title="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive (Draft + Closed)</option>
            </select>
            {creators.length > 1 && (
              <select
                title="Creator"
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All creators</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <DateInput label="From" title="From date" value={dateFrom} onChange={setDateFrom}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm w-full" />
            <DateInput label="To" title="To date" value={dateTo} onChange={setDateTo}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm w-full" />
            {filtersActive && (
              <button type="button" onClick={clearFilters}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 sm:mb-0">
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Create form ──────────────────────────────────── */}
      {showForm && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-gray-800">New event</h2>
          <form onSubmit={createEvent} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Event ID / Code <span className="text-red-500">*</span></label>
                <input required value={form.eventCode} onChange={(e) => f('eventCode', e.target.value)}
                  placeholder="EVT-001" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Event Name <span className="text-red-500">*</span></label>
                <input required value={form.eventName} onChange={(e) => f('eventName', e.target.value)}
                  placeholder="Summer Gala 2026" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Venue</label>
                <input value={form.venue} onChange={(e) => f('venue', e.target.value)}
                  placeholder="Grand Hotel" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Address</label>
                <input value={form.address} onChange={(e) => f('address', e.target.value)}
                  placeholder="123 Main St, New York, NY 10001" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateInput label="Date" title="Date" value={form.eventDate} onChange={(v) => f('eventDate', v)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Timing</label>
                <input value={form.timing} onChange={(e) => f('timing', e.target.value)}
                  placeholder="18:00 – 23:00" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Assigned DJ</label>
                <input value={form.assignedDj} onChange={(e) => f('assignedDj', e.target.value)}
                  placeholder="DJ Alex" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Assigned MC</label>
                <input value={form.assignedMc} onChange={(e) => f('assignedMc', e.target.value)}
                  placeholder="MC Sara" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Sales Person</label>
                <input value={form.salesPerson} onChange={(e) => f('salesPerson', e.target.value)}
                  placeholder="John Smith" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Status</label>
                <select title="Status" value={form.status} onChange={(e) => f('status', e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{formError}</p>}
            <Button type="submit" loading={saving}>Create event</Button>
          </form>
        </div>
      )}

      {/* ── Events calendar ───────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
          No events yet. Click &quot;+ New event&quot; or upload a CSV / PDF to get started.
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-500">No events match your search</p>
          <button type="button" onClick={clearFilters}
            className="mt-3 text-xs text-indigo-600 hover:underline font-medium">
            Clear filters
          </button>
        </div>
      ) : (
        <EventsCalendar events={filteredEvents} onSelect={openDetail} />
      )}
    </div>
  )
}
