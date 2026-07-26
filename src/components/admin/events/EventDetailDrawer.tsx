'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useModalDismiss } from '@/lib/use-modal-dismiss'
import { EVENT_STATUS_BADGE, type EventRow } from './types'

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}

const STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'CLOSED'] as const

interface EventDetailDrawerProps {
  event: EventRow
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  deleting: boolean
  confirmDelete: boolean
  onConfirmDeleteChange: (v: boolean) => void
  onStatusChanged: (updated: EventRow) => void
}

export function EventDetailDrawer({
  event, onClose, onEdit, onDelete, deleting, confirmDelete, onConfirmDeleteChange, onStatusChanged,
}: EventDetailDrawerProps) {
  // useModalDismiss only handles Escape + focus management — outside-click
  // needs its own listener on the same ref, same as the original inline
  // drawer this was extracted from.
  const drawerRef = useModalDismiss<HTMLDivElement>(true, onClose)

  const [summary, setSummary] = useState<{ expenseCount: number; expenseTotalUsd: number } | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [drawerRef, onClose])

  useEffect(() => {
    setSummary(null)
    fetch(`/api/events/${event.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSummary(data) })
      .catch(() => {})
  }, [event.id])

  async function changeStatus(status: string) {
    if (status === event.status || statusSaving) return
    setStatusSaving(true)
    const res = await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) onStatusChanged({ ...event, status })
    setStatusSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20 pointer-events-none" />
      <div ref={drawerRef} className="fixed right-0 top-0 h-full w-full max-w-md z-[51] flex flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-6 py-5">
          <div className="min-w-0 pr-4">
            <p className="font-mono text-xs text-gray-400">{event.eventCode}</p>
            <h2 className="mt-0.5 text-lg font-semibold text-gray-900 leading-tight">{event.eventName}</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <Badge variant={EVENT_STATUS_BADGE[event.status] ?? 'gray'}>{event.status}</Badge>
              <div className="flex items-center rounded-lg border border-gray-200 p-0.5">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={statusSaving}
                    onClick={() => changeStatus(s)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors disabled:opacity-50 ${
                      event.status === s ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {s.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Expense summary */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="mb-1 text-xs text-gray-400">Expenses submitted</p>
                <p className="text-xl font-bold text-gray-900">
                  {summary ? summary.expenseCount : event._count.expenses}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="mb-1 text-xs text-gray-400">Total amount</p>
                <p className="text-xl font-bold text-gray-900">
                  {summary ? `$${summary.expenseTotalUsd.toLocaleString('en-US')}` : '…'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailRow label="Venue" value={event.venue} />
              <DetailRow label="Address" value={event.address} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailRow
                label="Date"
                value={event.eventDate ? new Date(event.eventDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : null}
              />
              <DetailRow label="Timing" value={event.timing} />
            </div>
            <div className="h-px bg-gray-100" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailRow label="Creator" value={event.owner?.name} />
              <DetailRow label="Organizer" value={event.salesPerson} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailRow label="Assigned DJ" value={event.assignedDj} />
              <DetailRow label="Assigned MC" value={event.assignedMc} />
            </div>
            {(event.costCenter || event.budgetUsd > 0) && (
              <>
                <div className="h-px bg-gray-100" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {event.costCenter && <DetailRow label="Cost Center" value={event.costCenter} />}
                  {event.budgetUsd > 0 && <DetailRow label="Budget" value={`$${Number(event.budgetUsd).toLocaleString()}`} />}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center gap-3 flex-wrap">
          {confirmDelete ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-red-600 font-medium">Delete {event.eventName}?</span>
              <button type="button" onClick={onDelete} disabled={deleting}
                className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? '…' : 'Yes, delete'}
              </button>
              <button type="button" onClick={() => onConfirmDeleteChange(false)}
                className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          ) : (
            <>
              <Button type="button" onClick={onEdit}>Edit</Button>
              <button type="button" onClick={() => onConfirmDeleteChange(true)}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
