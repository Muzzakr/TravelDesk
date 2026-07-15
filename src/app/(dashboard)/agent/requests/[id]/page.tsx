'use client'

import { PaperAirplaneIcon, BuildingOfficeIcon, TruckIcon, MapPinIcon, UserGroupIcon, CreditCardIcon, PlusCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { Check, Paperclip } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { BookingConfirmationForm } from '@/components/travel/BookingConfirmationForm'
import { LoadError } from '@/components/ui/LoadError'

interface BookingConfirmation {
  id: string
  serviceType: string
  confirmationNumber: string | null
  notes: string | null
  fileName: string | null
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
  agentId: string | null
  createdAt: string
  employee: { name: string; email: string }
  event: { eventName: string; eventCode: string; budgetUsd: number; approvedSpendUsd: number }
  bookingOptions: BookingOption[]
  bookingConfirmations: BookingConfirmation[]
}

interface BookingOption {
  id: string
  serviceType: string
  vendor: string
  description: string
  priceUsd: number
  isSelected: boolean
  bookingLink: string | null
}

const STATUS_STEPS = ['Submitted', 'Agent Review', 'Approved', 'Confirmed']

const STATUS_TO_STEP: Record<string, number> = {
  SUBMITTED:         0,
  PENDING_AGENT:     1,
  OPTIONS_PROVIDED:  1,
  PENDING_MANAGER:   1,
  APPROVED:          2,
  BOOKING_CONFIRMED: 3,
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT:             'Submitted',
  SUBMITTED:         'Submitted',
  PENDING_AGENT:     'With agent',
  OPTIONS_PROVIDED:  'Options sent',
  PENDING_MANAGER:   'Manager review',
  APPROVED:          'Manager approved',
  BOOKING_CONFIRMED: 'Booking confirmed',
  REJECTED:          'Rejected',
  CANCELLED:         'Cancelled',
}

const SERVICE_ICON: Record<string, HeroIcon> = {
  FLIGHT: PaperAirplaneIcon,
  HOTEL: BuildingOfficeIcon,
  CAR_RENTAL: TruckIcon,
  TAXI: MapPinIcon,
  AGENT_CHOOSES: UserGroupIcon,
}

const SERVICE_LABEL: Record<string, string> = {
  FLIGHT: 'Flight',
  HOTEL: 'Hotel',
  CAR_RENTAL: 'Car Rental',
  TAXI: 'Taxi / Transfer',
  AGENT_CHOOSES: 'Agent Chooses',
}

const SERVICE_LINE_META: Record<string, { Icon: HeroIcon; label: string }> = {
  FLIGHT:        { Icon: PaperAirplaneIcon,  label: 'Flight' },
  HOTEL:         { Icon: BuildingOfficeIcon, label: 'Hotel' },
  TAXI:          { Icon: MapPinIcon,         label: 'Taxi / Transfer' },
  CAR:           { Icon: TruckIcon,          label: 'Car Rental' },
  AGENT_CHOOSES: { Icon: UserGroupIcon,      label: 'Agent selects services' },
  Payment:       { Icon: CreditCardIcon,     label: 'Payment' },
}

function parseServiceLine(line: string): { Icon: HeroIcon; label: string; detail: string } {
  const colon = line.indexOf(':')
  if (colon === -1) return { Icon: DocumentTextIcon, label: 'Note', detail: line }
  const key = line.slice(0, colon).trim()
  const meta = SERVICE_LINE_META[key] ?? { Icon: DocumentTextIcon, label: key }
  return { ...meta, detail: line.slice(colon + 1).trim() }
}

export default function AgentRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [request, setRequest] = useState<TravelRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loadError, setLoadError] = useState(false)

  async function load() {
    setLoadError(false)
    try {
      const r = await fetch(`/api/travel-requests/${id}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data: TravelRequest = await r.json()
      setRequest(data)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAssign() {
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/travel-requests/${id}/assign`, { method: 'POST' })
    if (res.ok) {
      setSuccess('Booking assigned to you.')
      const updated = await fetch(`/api/travel-requests/${id}`).then((r) => r.json())
      setRequest(updated)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to assign')
    }
    setSubmitting(false)
  }

  async function handleConfirmed() {
    setSuccess('Booking confirmed! The employee has been notified.')
    const updated = await fetch(`/api/travel-requests/${id}`).then((r) => r.json())
    setRequest(updated)
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!request) {
    if (loadError) return <div className="p-8"><LoadError onRetry={() => { setLoading(true); load() }} /></div>
    return <div className="p-8 text-red-500">Request not found.</div>
  }

  const isUnassigned = !request.agentId && request.status === 'PENDING_AGENT'
  const canConfirm = ['PENDING_AGENT', 'APPROVED'].includes(request.status) && request.status !== 'BOOKING_CONFIRMED'

  const budgetPct = request.event.budgetUsd > 0
    ? Math.round((Number(request.event.approvedSpendUsd) / Number(request.event.budgetUsd)) * 100)
    : 0

  const currentStep = STATUS_TO_STEP[request.status] ?? 0
  const isTerminal = ['REJECTED', 'CANCELLED'].includes(request.status)

  // The employee's final selection. If any options are explicitly marked selected
  // (agent-provided → employee-picked flow), show those; otherwise the saved
  // options are the employee's own picks (employee-initiated AI-options flow).
  const allOptions = request.bookingOptions ?? []
  const explicitlySelected = allOptions.filter((o) => o.isSelected)
  const employeeSelection = explicitlySelected.length > 0 ? explicitlySelected : allOptions

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Travel request detail</h1>
        <Badge variant={statusToBadgeVariant(request.status)}>{request.status.replace(/_/g, ' ')}</Badge>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {/* Status timeline */}
      {!isTerminal && (
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-start">
            {STATUS_STEPS.map((stepLabel, i) => {
              const done = i < currentStep
              const active = i === currentStep
              return (
                <div key={stepLabel} className="flex items-start flex-1 last:flex-none">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors
                      ${done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <p className={`mt-1.5 text-[10px] font-semibold whitespace-nowrap text-center ${active ? 'text-indigo-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                      {active ? (STATUS_LABELS[request.status] ?? stepLabel) : stepLabel}
                    </p>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-2 mt-4 rounded ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Request details */}
      <div className="rounded-xl border bg-white p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Employee</p>
            <p className="font-medium text-gray-900">{request.employee.name}</p>
            <p className="text-gray-500">{request.employee.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Event</p>
            <p className="font-medium text-gray-900">{request.event.eventName}</p>
            <p className="text-gray-500">{request.event.eventCode}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Route</p>
            <p className="font-medium text-gray-900">{request.origin} → {request.destination}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Dates</p>
            <p className="text-gray-900">{request.travelDates.departureDate} → {request.travelDates.returnDate}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Services</p>
            <p className="text-gray-900">{request.servicesRequested.map((s) => SERVICE_LABEL[s] ?? s).join(', ')}</p>
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
        </div>

        {/* Trip details (structured) */}
        {!!request.specialInstructions && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase mb-2">Trip details</p>
            <div className="space-y-2">
              {String(request.specialInstructions).split('\n').filter(Boolean).map((line, i) => {
                const { Icon: LineIcon, label, detail } = parseServiceLine(line)
                return (
                  <div key={i} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <LineIcon className="w-5 h-5 shrink-0 text-gray-500 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                      <p className="text-sm text-gray-900 mt-0.5">{detail}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Employee's selected option(s) */}
        {employeeSelection.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase mb-2">Selected option</p>
            <div className="space-y-2">
              {employeeSelection.map((opt) => {
                const OptIcon = SERVICE_ICON[opt.serviceType] ?? PlusCircleIcon
                const isCustom = opt.vendor === 'Own choice' || !!opt.bookingLink
                // The custom link may be stored in bookingLink or embedded in the description
                let messageText = opt.description
                let link = opt.bookingLink ?? null
                if (!link) {
                  const m = opt.description.match(/https?:\/\/\S+/)
                  if (m) { link = m[0]; messageText = opt.description.replace(m[0], '').replace(/\s*[—-]\s*$/, '').trim() }
                }
                return (
                  <div key={opt.id} className="flex gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
                    <OptIcon className="w-5 h-5 shrink-0 text-indigo-500 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{SERVICE_LABEL[opt.serviceType] ?? opt.serviceType}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isCustom ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {isCustom ? 'Custom link' : 'Provided option'}
                        </span>
                      </div>
                      {!isCustom && (
                        <p className="text-sm font-medium text-gray-900 mt-0.5">
                          {opt.vendor}{opt.priceUsd > 0 ? ` · $${Number(opt.priceUsd).toFixed(0)}` : ''}
                        </p>
                      )}
                      {messageText && <p className="text-sm text-gray-700 mt-0.5 break-words">{messageText}</p>}
                      {link && (
                        <a href={link} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline mt-1 break-all">
                          Open booking link →
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Event budget */}
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs font-medium text-gray-400 uppercase mb-2">Event budget</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
              /* eslint-disable-next-line react/forbid-component-props */
              style={{ width: `${Math.min(budgetPct, 100)}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700">{budgetPct}%</span>
          <span className="text-xs text-gray-500">
            ${Number(request.event.approvedSpendUsd).toFixed(0)} / ${Number(request.event.budgetUsd).toFixed(0)}
          </span>
        </div>
      </div>

      {/* Assign button */}
      {isUnassigned && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 flex items-center justify-between">
          <p className="text-sm text-yellow-800">This request is not yet assigned to an agent.</p>
          <button
            type="button"
            onClick={handleAssign}
            disabled={submitting}
            className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
          >
            Accept booking
          </button>
        </div>
      )}

      {/* Complete booking form (shared with Travel Manager / Admin) */}
      {canConfirm && (
        <BookingConfirmationForm
          requestId={id}
          servicesRequested={request.servicesRequested}
          onSuccess={handleConfirmed}
        />
      )}

      {/* Already confirmed: show booking confirmations */}
      {request.status === 'BOOKING_CONFIRMED' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-green-800">Booking confirmed</p>
          {request.bookingConfirmations.length > 0 ? (
            <div className="space-y-2">
              {request.bookingConfirmations.map((c) => {
                const SvcIcon = SERVICE_ICON[c.serviceType] ?? PlusCircleIcon
                return (
                <div key={c.id} className="flex items-start gap-3 rounded-lg border border-green-100 bg-white px-3 py-2.5">
                  <SvcIcon className="w-5 h-5 shrink-0 text-gray-500 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase">{SERVICE_LABEL[c.serviceType] ?? c.serviceType}</p>
                    {c.confirmationNumber && <p className="text-sm font-mono font-bold text-green-700 mt-0.5">{c.confirmationNumber}</p>}
                    {c.notes && <p className="text-xs text-gray-600 mt-0.5">{c.notes}</p>}
                    {c.fileName && (
                      <a href={`/api/booking-confirmations/${c.id}/file`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1">
                        <Paperclip className="w-3.5 h-3.5" /> {c.fileName}
                      </a>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            request.confirmationNumber && (
              <p className="text-sm text-green-700">Confirmation: <span className="font-mono font-bold">{request.confirmationNumber}</span></p>
            )
          )}
        </div>
      )}
    </div>
  )
}
