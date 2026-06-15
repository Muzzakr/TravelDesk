'use client'

import { PaperAirplaneIcon, BuildingOfficeIcon, TruckIcon, MapPinIcon, UserGroupIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'
type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'
import { Check, Paperclip } from 'lucide-react'

interface BookingOption {
  id: string
  serviceType: string
  vendor: string
  description: string
  priceUsd: number
  bookingLink?: string | null
  isSelected: boolean
}

interface BookingConfirmation {
  id: string
  serviceType: string
  confirmationNumber: string | null
  notes: string | null
  fileName: string | null
}

const SERVICE_ICON: Record<string, HeroIcon> = {
  FLIGHT: PaperAirplaneIcon, HOTEL: BuildingOfficeIcon, CAR_RENTAL: TruckIcon, TAXI: MapPinIcon, AGENT_CHOOSES: UserGroupIcon,
}
const SERVICE_LABEL: Record<string, string> = {
  FLIGHT: 'Flight', HOTEL: 'Hotel', CAR_RENTAL: 'Car Rental', TAXI: 'Taxi / Transfer', AGENT_CHOOSES: 'Agent Chooses',
}

interface Expense {
  id: string
  description: string
  amountUsd: number
  category: string
  status: string
  merchantName: string | null
}

const VENDOR_URLS: Record<string, string> = {
  sas: 'https://www.flysas.com',
  norwegian: 'https://www.norwegian.com',
  'british airways': 'https://www.britishairways.com',
  marriott: 'https://www.marriott.com',
  hilton: 'https://www.hilton.com',
  citizenm: 'https://www.citizenm.com',
  hertz: 'https://www.hertz.com',
  avis: 'https://www.avis.com',
  europcar: 'https://www.europcar.com',
}

function getBookingUrl(merchantName: string | null, category: string): string {
  if (!merchantName) return ''
  const base = VENDOR_URLS[merchantName.toLowerCase()]
  if (base) return base
  const q = encodeURIComponent(`${merchantName} ${category.replace('_', ' ')} booking`)
  return `https://www.google.com/search?q=${q}`
}

interface TravelRequest {
  id: string
  status: string
  routingPath: string
  origin: string
  destination: string
  travelDates: { departureDate: string; returnDate: string }
  servicesRequested: string[]
  estimatedCostUsd: number | null
  purpose: string
  preferredClass: string
  hotelNights: number | null
  carRentalDays: number | null
  specialInstructions: string | null
  confirmationNumber: string | null
  confirmationDocUrl: string | null
  rejectionNote: string | null
  createdAt: string
  event: { eventName: string; eventCode: string; budgetUsd: number; approvedSpendUsd: number }
  bookingOptions: BookingOption[]
  bookingConfirmations: BookingConfirmation[]
  expenses: Expense[]
  approvalActions: { actionType: string; note: string | null; createdAt: string; actor: { name: string; role: string } }[]
}

const STATUS_STEPS = [
  'SUBMITTED',
  'PENDING_MANAGER',
  'PENDING_AGENT',
  'BOOKING_CONFIRMED',
]

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Submitted',
  SUBMITTED: 'Submitted',
  PENDING_MANAGER: 'Manager review',
  PENDING_AGENT: 'With travel agent',
  APPROVED: 'With travel agent',
  OPTIONS_PROVIDED: 'With travel agent',
  BOOKING_CONFIRMED: 'Booking confirmed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

export default function EmployeeTravelRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [request, setRequest] = useState<TravelRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  // one selected optionId per serviceType: { FLIGHT: 'id1', HOTEL: 'id2', CAR_RENTAL: 'id3' }
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [cancelNote, setCancelNote] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [editPurpose, setEditPurpose] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function load() {
    const res = await fetch(`/api/travel-requests/${id}`)
    if (res.ok) setRequest(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function confirmSelections() {
    setConfirming(true)
    setError('')
    const res = await fetch(`/api/travel-requests/${id}/select-option`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionIds: Object.values(picks) }),
    })
    if (res.ok) {
      await load()
      setPicks({})
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to confirm selections')
    }
    setConfirming(false)
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!request) return <div className="p-8 text-red-500">Request not found.</div>

  async function saveEdit() {
    setSavingEdit(true)
    setError('')
    const res = await fetch(`/api/travel-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: editPurpose, specialInstructions: editNotes }),
    })
    if (res.ok) { setEditingDetails(false); await load() }
    else { const d = await res.json(); setError(d.error ?? 'Failed to save') }
    setSavingEdit(false)
  }

  async function cancelBooking() {
    setCancelling(true)
    setError('')
    const res = await fetch(`/api/travel-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED', rejectionNote: cancelNote || 'Cancelled by employee' }),
    })
    if (res.ok) {
      setShowCancelModal(false)
      setCancelNote('')
      await load()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to cancel')
    }
    setCancelling(false)
  }

  const dates = request.travelDates
  const isTerminal = ['REJECTED', 'CANCELLED'].includes(request.status)
  const currentStep = STATUS_STEPS.indexOf(request.status)

  // Group booking options by service type
  const optionsByService = request.bookingOptions.reduce<Record<string, BookingOption[]>>((acc, opt) => {
    if (!acc[opt.serviceType]) acc[opt.serviceType] = []
    acc[opt.serviceType].push(opt)
    return acc
  }, {})

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/employee/travel-requests" className="text-xs text-indigo-600 hover:underline">← All travel requests</Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{request.origin} → {request.destination}</h1>
          <p className="text-sm text-gray-500">{request.event.eventName} · {dates.departureDate}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={statusToBadgeVariant(request.status)}>
            {STATUS_LABELS[request.status] ?? request.status.replace(/_/g, ' ')}
          </Badge>
          {request.status === 'BOOKING_CONFIRMED' && (
            <button type="button" onClick={() => setShowCancelModal(true)}
              className="text-xs text-red-500 hover:text-red-700 hover:underline">
              Cancel booking
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Progress bar */}
      {!isTerminal && (
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-start gap-0">
            {STATUS_STEPS.map((step, i) => {
              const done = i < currentStep
              const active = i === currentStep
              return (
                <div key={step} className="flex items-start flex-1 last:flex-none">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold
                      ${done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    {active && (
                      <p className="mt-1 text-[10px] text-gray-500 font-medium whitespace-nowrap text-center">
                        {STATUS_LABELS[request.status] ?? request.status.replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mt-3.5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rejection note */}
      {request.status === 'REJECTED' && request.rejectionNote && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Rejected</p>
          <p className="mt-1 text-sm text-red-700">{request.rejectionNote}</p>
        </div>
      )}

      {/* Booking confirmed banner */}
      {request.status === 'BOOKING_CONFIRMED' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-green-800">Your trip is booked!</p>

          {/* Per-service booking confirmations */}
          {request.bookingConfirmations && request.bookingConfirmations.length > 0 ? (
            <div className="space-y-2">
              {request.bookingConfirmations.map((c) => {
                const SvcIcon = SERVICE_ICON[c.serviceType] ?? PlusCircleIcon
                return (
                <div key={c.id} className="flex items-start gap-3 rounded-lg border border-green-100 bg-white px-3 py-2.5">
                  <SvcIcon className="w-5 h-5 shrink-0 text-gray-500 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{SERVICE_LABEL[c.serviceType] ?? c.serviceType}</p>
                    {c.confirmationNumber && (
                      <p className="text-sm font-mono font-bold text-green-700 mt-0.5">{c.confirmationNumber}</p>
                    )}
                    {c.notes && <p className="text-xs text-gray-600 mt-0.5">{c.notes}</p>}
                    {c.fileName && (
                      <a
                        href={`/api/booking-confirmations/${c.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1"
                      >
                        <Paperclip className="w-3.5 h-3.5" /> {c.fileName}
                      </a>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            /* Fallback: old flat confirmationNumber */
            request.confirmationNumber && (
              <p className="text-sm text-green-700">Confirmation: <span className="font-mono font-bold">{request.confirmationNumber}</span></p>
            )
          )}

          {request.confirmationDocUrl && (
            <a
              href={request.confirmationDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              View booking document →
            </a>
          )}
        </div>
      )}

      {/* Choose booking options — step 4 */}
      {request.status === 'OPTIONS_PROVIDED' && request.bookingOptions.length > 0 && (
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-indigo-900">Choose your preferred options</h2>
            <p className="text-xs text-indigo-700 mt-0.5">Select one option per category, then confirm to send for manager approval.</p>
          </div>

          {Object.entries(optionsByService).map(([serviceType, opts]) => (
            <div key={serviceType} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {serviceType.replace('_', ' ')}
              </p>
              {opts.map((opt) => {
                const isChosen = picks[serviceType] === opt.id
                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 rounded-lg border bg-white p-4 cursor-pointer transition-colors
                      ${isChosen ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input
                      type="radio"
                      name={serviceType}
                      value={opt.id}
                      checked={isChosen}
                      onChange={() => setPicks((prev) => ({ ...prev, [serviceType]: opt.id }))}
                      className="mt-1 accent-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{opt.vendor}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
                      {opt.bookingLink && (
                        <a href={opt.bookingLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          View booking →
                        </a>
                      )}
                    </div>
                    <p className="text-sm font-bold text-indigo-700 shrink-0">${Number(opt.priceUsd).toFixed(2)}</p>
                  </label>
                )
              })}
            </div>
          ))}

          {/* Summary */}
          {Object.keys(picks).length > 0 && (
            <div className="rounded-xl border border-indigo-200 bg-white p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800">Your selection summary</p>
              {Object.entries(picks).map(([serviceType, optId]) => {
                const opt = request.bookingOptions.find((o) => o.id === optId)
                if (!opt) return null
                return (
                  <div key={serviceType} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-xs font-medium uppercase text-gray-400 mr-2">{serviceType.replace('_', ' ')}</span>
                      <span className="font-medium text-gray-900">{opt.vendor}</span>
                      <span className="text-gray-500 ml-2">— {opt.description}</span>
                    </div>
                    <span className="font-bold text-indigo-700 shrink-0 ml-4">${Number(opt.priceUsd).toFixed(2)}</span>
                  </div>
                )
              })}
              <div className="flex items-center justify-between border-t pt-3">
                <p className="text-sm font-semibold text-gray-700">
                  Total: <span className="text-indigo-700">
                    ${Object.values(picks).reduce((sum, optId) => {
                      const opt = request.bookingOptions.find((o) => o.id === optId)
                      return sum + (opt ? Number(opt.priceUsd) : 0)
                    }, 0).toFixed(2)}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={confirmSelections}
                  disabled={confirming || Object.keys(picks).length < Object.keys(optionsByService).length}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {confirming ? 'Confirming…' : 'Confirm selections →'}
                </button>
              </div>
              {Object.keys(picks).length < Object.keys(optionsByService).length && (
                <p className="text-xs text-amber-600">Select one option from each category to continue.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Request details */}
      <div className="rounded-xl border bg-white p-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Route</p>
          <p className="font-medium text-gray-900">{request.origin} → {request.destination}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Dates</p>
          <p className="text-gray-900">{dates.departureDate} → {dates.returnDate}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Services</p>
          <p className="text-gray-900">{request.servicesRequested.join(', ')}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Class / Est. cost</p>
          <p className="text-gray-900">
            {request.preferredClass}
            {request.estimatedCostUsd ? ` · $${Number(request.estimatedCostUsd).toFixed(0)}` : ''}
          </p>
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-400 uppercase">Purpose</p>
            {['SUBMITTED', 'PENDING_MANAGER'].includes(request.status) && !editingDetails && (
              <button type="button" onClick={() => { setEditPurpose(request.purpose); setEditNotes(request.specialInstructions ?? ''); setEditingDetails(true) }}
                className="text-xs text-indigo-600 hover:underline">Edit</button>
            )}
          </div>
          {editingDetails ? (
            <div className="space-y-2">
              <textarea rows={2} title="Purpose" placeholder="Purpose of trip…" value={editPurpose} onChange={e => setEditPurpose(e.target.value)}
                className="w-full rounded-lg border border-indigo-300 px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <textarea rows={3} value={editNotes} onChange={e => setEditNotes(e.target.value)}
                placeholder="Notes / special instructions…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <div className="flex gap-2">
                <button type="button" onClick={saveEdit} disabled={savingEdit}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {savingEdit ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" onClick={() => setEditingDetails(false)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-900">{request.purpose}</p>
          )}
        </div>
        {!editingDetails && request.specialInstructions && (
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Notes</p>
            <p className="text-gray-700 whitespace-pre-wrap">{request.specialInstructions}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Routing</p>
          <p className="text-gray-500 text-xs">{request.routingPath.replace(/_/g, ' ')}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Submitted</p>
          <p className="text-gray-500 text-xs">{new Date(request.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Auto-created expense records */}
      {request.expenses && request.expenses.length > 0 && (
        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Expense records</h2>
            <Link href="/employee/expenses" className="text-xs text-indigo-600 hover:underline">View all expenses →</Link>
          </div>
          <p className="text-xs text-gray-500 mb-3">These draft expense records were auto-created from your booking. Review and submit them after your trip.</p>
          <div className="space-y-2">
            {request.expenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{exp.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">{exp.category}</p>
                    {getBookingUrl(exp.merchantName, exp.category) && (
                      <a
                        href={getBookingUrl(exp.merchantName, exp.category)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        View booking →
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-gray-900">${Number(exp.amountUsd).toFixed(2)}</p>
                  <Badge variant={statusToBadgeVariant(exp.status)}>{exp.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval history */}
      {request.approvalActions && request.approvalActions.length > 0 && (
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Approval history</h2>
          <div className="space-y-3">
            {request.approvalActions.map((action, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                <div>
                  <p className="font-medium text-gray-900">
                    {action.actor.name} <span className="text-gray-400 font-normal">({action.actionType})</span>
                  </p>
                  {action.note && <p className="text-gray-500 text-xs mt-0.5">&quot;{action.note}&quot;</p>}
                  <p className="text-xs text-gray-400">{new Date(action.createdAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Cancel booking modal */}
      {showCancelModal && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/40" onClick={() => setShowCancelModal(false)} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Cancel confirmed booking</h2>
              <p className="text-sm text-gray-500">This will cancel your booking. Please provide a reason.</p>
              <textarea
                rows={3}
                placeholder="Reason for cancellation (optional)…"
                value={cancelNote}
                onChange={e => setCancelNote(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowCancelModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Keep booking
                </button>
                <button type="button" onClick={cancelBooking} disabled={cancelling}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {cancelling ? 'Cancelling…' : 'Confirm cancel'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
