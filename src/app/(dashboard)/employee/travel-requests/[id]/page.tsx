'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'

interface BookingOption {
  id: string
  serviceType: string
  vendor: string
  description: string
  priceUsd: number
  isSelected: boolean
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
  rejectionNote: string | null
  createdAt: string
  event: { eventName: string; eventCode: string; budgetUsd: number; approvedSpendUsd: number }
  bookingOptions: BookingOption[]
  expenses: Expense[]
  approvalActions: { actionType: string; note: string | null; createdAt: string; actor: { name: string; role: string } }[]
}

const STATUS_STEPS = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_AGENT',
  'OPTIONS_PROVIDED',
  'PENDING_MANAGER',
  'APPROVED',
  'BOOKING_CONFIRMED',
]

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_AGENT: 'With travel agent',
  OPTIONS_PROVIDED: 'Choose your option',
  PENDING_MANAGER: 'Manager review',
  APPROVED: 'Approved',
  BOOKING_CONFIRMED: 'Booking confirmed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

export default function EmployeeTravelRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [request, setRequest] = useState<TravelRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  // one selected optionId per serviceType: { FLIGHT: 'id1', HOTEL: 'id2', CAR_RENTAL: 'id3' }
  const [picks, setPicks] = useState<Record<string, string>>({})

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

  const dates = request.travelDates
  const isTerminal = ['REJECTED', 'CANCELLED', 'BOOKING_CONFIRMED'].includes(request.status)
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
        <Badge variant={statusToBadgeVariant(request.status)}>
          {STATUS_LABELS[request.status] ?? request.status.replace(/_/g, ' ')}
        </Badge>
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
                      {done ? '✓' : i + 1}
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
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">Booking confirmed!</p>
          {request.confirmationNumber && (
            <p className="mt-1 text-sm text-green-700">Confirmation number: <span className="font-mono font-bold">{request.confirmationNumber}</span></p>
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
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{opt.vendor}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
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
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Purpose</p>
          <p className="text-gray-900">{request.purpose}</p>
        </div>
        {request.specialInstructions && (
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
                  {action.note && <p className="text-gray-500 text-xs mt-0.5">"{action.note}"</p>}
                  <p className="text-xs text-gray-400">{new Date(action.createdAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
