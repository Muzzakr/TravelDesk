'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

type TravelRequest = {
  id: string
  origin: string
  destination: string
  status: string
  travelDates: Record<string, string>
  servicesRequested: string[]
  estimatedCostUsd: string | null
  preferredClass: string
  purpose: string
  specialInstructions: string | null
  rejectionNote: string | null
  adminEscalationNote: string | null
  createdAt: string
  employee: { id: string; name: string; email: string }
  event: { id: string; eventName: string; eventCode: string }
  agent: { id: string; name: string; email: string } | null
  approvalActions: { id: string; actionType: string; note: string | null; createdAt: string; actor: { name: string; role: string } }[]
  bookingOptions: { id: string; serviceType: string; vendor: string; description: string; priceUsd: string; isSelected: boolean }[]
  bookingConfirmations: { id: string; serviceType: string; confirmationNumber: string | null; notes: string | null }[]
}

const STEP_LABELS = ['Submitted', 'Manager Review', 'Approved', 'Confirmed']
const STATUS_TO_STEP: Record<string, number> = {
  SUBMITTED: 0, PENDING_MANAGER: 1, OPTIONS_PROVIDED: 1, PENDING_AGENT: 2,
  APPROVED: 2, BOOKING_CONFIRMED: 3,
}

function fmt(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const ACTIONABLE = ['SUBMITTED', 'PENDING_MANAGER', 'PENDING_ADMIN', 'PENDING_AGENT', 'OPTIONS_PROVIDED', 'APPROVED']

export default function AdminTravelRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [request, setRequest] = useState<TravelRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [action, setAction] = useState<'approve' | 'reject' | 'cancel' | null>(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  useEffect(() => {
    fetch(`/api/travel-requests/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setRequest(d)
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  async function submitAction() {
    if (!action) return
    if ((action === 'reject' || action === 'cancel') && action === 'reject' && !rejectionNote.trim()) {
      setActionError('Please enter a rejection reason.'); return
    }
    setSubmitting(true); setActionError(''); setActionSuccess('')

    const body: Record<string, unknown> = {}
    if (action === 'approve') body.status = 'APPROVED'
    if (action === 'reject') { body.status = 'REJECTED'; body.rejectionNote = rejectionNote.trim() }
    if (action === 'cancel') { body.status = 'CANCELLED'; body.rejectionNote = 'Cancelled by admin.' }

    const res = await fetch(`/api/travel-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setActionSuccess(action === 'cancel' ? 'Request cancelled.' : action === 'approve' ? 'Request approved.' : 'Request rejected.')
      setAction(null)
      setRejectionNote('')
      const updated = await fetch(`/api/travel-requests/${id}`).then(r => r.json())
      setRequest(updated)
    } else {
      const d = await res.json()
      setActionError(d.error ?? 'Action failed.')
    }
    setSubmitting(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[40vh] text-sm text-gray-400">Loading…</div>
  if (error || !request) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-2">
      <p className="text-red-500 text-sm">{error || 'Not found'}</p>
      <Link href="/admin/travel-requests" className="text-indigo-600 text-sm hover:underline">← Back</Link>
    </div>
  )

  const dates = request.travelDates
  const currentStep = STATUS_TO_STEP[request.status] ?? 0
  const isTerminal = ['REJECTED', 'CANCELLED'].includes(request.status)
  const canAction = ACTIONABLE.includes(request.status)

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      {/* Back + header */}
      <Link href="/admin/travel-requests" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> All Travel Requests
      </Link>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">{request.origin} → {request.destination}</h1>
        <Badge variant={statusToBadgeVariant(request.status)}>{request.status.replace(/_/g, ' ')}</Badge>
      </div>

      {/* Stepper */}
      {!isTerminal && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start">
            {STEP_LABELS.map((label, i) => {
              const done = i < currentStep; const active = i === currentStep
              return (
                <div key={label} className="flex items-start flex-1 last:flex-none">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors
                      ${done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <p className={`mt-1.5 text-[10px] font-semibold whitespace-nowrap ${active ? 'text-indigo-600' : done ? 'text-green-600' : 'text-gray-400'}`}>{label}</p>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-2 mt-4 rounded ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isTerminal && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${request.status === 'CANCELLED' ? 'bg-gray-100 text-gray-700' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {request.status === 'CANCELLED' ? 'This request was cancelled.' : `Rejected: ${request.rejectionNote ?? 'No reason given.'}`}
        </div>
      )}

      {request.status === 'PENDING_ADMIN' && request.adminEscalationNote && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Manager requested your review</p>
            <p className="text-sm text-amber-700 mt-0.5">{request.adminEscalationNote}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Employee card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {initials(request.employee.name)}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{request.employee.name}</p>
              <p className="text-sm text-gray-500">{request.employee.email}</p>
              <p className="text-xs text-gray-400 mt-1">Submitted {fmt(request.createdAt)}</p>
            </div>
          </div>

          {/* Request details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Request details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Route',        `${request.origin} → ${request.destination}`],
                ['Departure',    dates.departureDate],
                ['Return',       dates.returnDate],
                ['Event',        `${request.event.eventName} (${request.event.eventCode})`],
                ['Services',     request.servicesRequested.join(', ')],
                ['Class',        request.preferredClass],
                ['Est. cost',    request.estimatedCostUsd ? `$${Number(request.estimatedCostUsd).toFixed(0)}` : '—'],
                ['Agent',        request.agent?.name ?? 'Unassigned'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</dt>
                  <dd className="text-gray-900 font-medium mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>
            {request.purpose && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Purpose</dt>
                <dd className="text-sm text-gray-800">{request.purpose}</dd>
              </div>
            )}
            {request.specialInstructions && (
              <div className="mt-3">
                <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Special instructions</dt>
                <dd className="text-sm text-gray-800">{request.specialInstructions}</dd>
              </div>
            )}
          </div>

          {/* Booking options */}
          {request.bookingOptions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Booking options</h2>
              <div className="space-y-2">
                {request.bookingOptions.map(o => (
                  <div key={o.id} className={`rounded-xl border p-3 text-sm ${o.isSelected ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{o.vendor} · {o.serviceType}</p>
                        <p className="text-xs text-gray-500">{o.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900">${Number(o.priceUsd).toFixed(0)}</p>
                        {o.isSelected && <span className="text-[10px] text-indigo-600 font-semibold">SELECTED</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval history */}
          {request.approvalActions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Approval history</h2>
              <div className="space-y-3">
                {request.approvalActions.map(a => (
                  <div key={a.id} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{a.actionType.replace(/_/g, ' ')} <span className="text-gray-400 font-normal">by {a.actor.name}</span></p>
                      {a.note && <p className="text-xs text-gray-500 italic">&ldquo;{a.note}&rdquo;</p>}
                      <p className="text-xs text-gray-400">{fmt(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — Admin action panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Admin actions</h2>

            {actionSuccess && (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 mb-4 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" /> {actionSuccess}
              </div>
            )}

            {actionError && (
              <p className="text-sm text-red-600 rounded-xl bg-red-50 px-3 py-2 mb-4">{actionError}</p>
            )}

            {!['REJECTED', 'CANCELLED'].includes(request.status) && (
              <Link
                href={`/agent/requests/${request.id}`}
                className="mb-4 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <span>Send booking info to employee</span>
                <span aria-hidden>→</span>
              </Link>
            )}

            {canAction && !action && (
              <div className="space-y-2">
                <button type="button" onClick={() => setAction('approve')}
                  className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white py-2.5 text-sm font-semibold transition-colors">
                  ✓ Approve request
                </button>
                <button type="button" onClick={() => setAction('reject')}
                  className="w-full rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 py-2.5 text-sm font-semibold transition-colors">
                  ✕ Reject request
                </button>
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <button type="button" onClick={() => setAction('cancel')}
                    className="w-full rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 py-2.5 text-sm font-medium transition-colors">
                    Cancel request (override)
                  </button>
                </div>
              </div>
            )}

            {action === 'approve' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">Confirm approval of this travel request?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={submitAction} disabled={submitting}
                    className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 text-sm font-semibold">
                    {submitting ? 'Approving…' : 'Confirm approve'}
                  </button>
                  <button type="button" onClick={() => setAction(null)}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {action === 'reject' && (
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Rejection reason <span className="text-red-500">*</span></label>
                  <textarea value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} rows={3}
                    placeholder="Explain why this request is being rejected…"
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none resize-none" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={submitAction} disabled={submitting || !rejectionNote.trim()}
                    className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 text-sm font-semibold">
                    {submitting ? 'Rejecting…' : 'Confirm reject'}
                  </button>
                  <button type="button" onClick={() => { setAction(null); setRejectionNote('') }}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {action === 'cancel' && (
              <div className="space-y-3">
                <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5">
                  This will cancel the request and notify the employee. Use this only as an admin override.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={submitAction} disabled={submitting}
                    className="flex-1 rounded-xl bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white py-2.5 text-sm font-semibold">
                    {submitting ? 'Cancelling…' : 'Confirm cancel'}
                  </button>
                  <button type="button" onClick={() => setAction(null)}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                    Back
                  </button>
                </div>
              </div>
            )}

            {!canAction && !actionSuccess && (
              <p className="text-sm text-gray-400">No actions available — request is {request.status.toLowerCase().replace(/_/g, ' ')}.</p>
            )}

            {/* View employee profile link */}
            <div className="mt-4 pt-4 border-t border-gray-50">
              <Link href={`/agent/employees/${request.employee.id}`}
                className="text-xs text-indigo-600 hover:underline font-medium">
                View employee profile →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}