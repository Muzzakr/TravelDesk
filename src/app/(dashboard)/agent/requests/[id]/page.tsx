'use client'

import { PaperAirplaneIcon, BuildingOfficeIcon, TruckIcon, MapPinIcon, UserGroupIcon, CreditCardIcon, PlusCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { Check, Paperclip } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

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
}

type ServiceEntry = {
  confirmationNumber: string
  notes: string
  files: File[]
}

const STATUS_STEPS = ['SUBMITTED', 'PENDING_MANAGER', 'PENDING_AGENT', 'BOOKING_CONFIRMED']

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Submitted',
  SUBMITTED: 'Submitted',
  PENDING_MANAGER: 'Manager review',
  PENDING_AGENT: 'With agent',
  APPROVED: 'With agent',
  OPTIONS_PROVIDED: 'With agent',
  BOOKING_CONFIRMED: 'Booking confirmed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
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

const ALL_SERVICES = ['FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TAXI']

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

function emptyEntry(): ServiceEntry {
  return { confirmationNumber: '', notes: '', files: [] }
}

export default function AgentRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [request, setRequest] = useState<TravelRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Per-service confirmation state
  const [serviceEntries, setServiceEntries] = useState<Record<string, ServiceEntry>>({})
  // For AGENT_CHOOSES: agent can pick which services they're confirming
  const [agentPickedServices, setAgentPickedServices] = useState<string[]>([])

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/travel-requests/${id}`)
        if (!r.ok) { setLoading(false); return }
        const data: TravelRequest = await r.json()
        setRequest(data)
        setLoading(false)
        const initial: Record<string, ServiceEntry> = {}
        const svcs = data.servicesRequested.includes('AGENT_CHOOSES') ? [] : data.servicesRequested
        svcs.forEach((s) => { initial[s] = emptyEntry() })
        setServiceEntries(initial)
        if (data.servicesRequested.includes('AGENT_CHOOSES')) {
          setAgentPickedServices(['AGENT_CHOOSES'])
          setServiceEntries({ AGENT_CHOOSES: emptyEntry() })
        }
      } catch {
        setLoading(false)
      }
    }
    load()
  }, [id])

  function updateEntry(svc: string, field: 'confirmationNumber' | 'notes', value: string) {
    setServiceEntries((prev) => ({ ...prev, [svc]: { ...prev[svc], [field]: value } }))
  }

  function addFile(svc: string, file: File) {
    setServiceEntries((prev) => ({ ...prev, [svc]: { ...prev[svc], files: [...(prev[svc]?.files ?? []), file] } }))
    if (fileInputRefs.current[svc]) fileInputRefs.current[svc]!.value = ''
  }

  function removeFile(svc: string, index: number) {
    setServiceEntries((prev) => ({ ...prev, [svc]: { ...prev[svc], files: prev[svc].files.filter((_, i) => i !== index) } }))
  }

  function toggleAgentService(svc: string) {
    setAgentPickedServices((prev) => {
      const next = prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
      setServiceEntries((entries) => {
        const updated = { ...entries }
        if (!prev.includes(svc)) { updated[svc] = emptyEntry() }
        else { delete updated[svc] }
        return updated
      })
      return next
    })
  }

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

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const services = Object.entries(serviceEntries).map(([serviceType, entry]) => ({
      serviceType,
      confirmationNumber: entry.confirmationNumber || undefined,
      notes: entry.notes || undefined,
    }))

    if (services.length === 0) {
      setError('Add at least one service confirmation.')
      setSubmitting(false)
      return
    }

    // Step 1: POST the JSON confirmation data
    const res = await fetch(`/api/travel-requests/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ services }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to confirm booking')
      setSubmitting(false)
      return
    }

    const { confirmationIds } = await res.json() as { confirmationIds: Record<string, string> }

    // Step 2: Upload all files for each service
    const fileUploads = Object.entries(serviceEntries)
      .filter(([, entry]) => entry.files.length > 0)
      .flatMap(([serviceType, entry]) => {
        const confId = confirmationIds[serviceType]
        if (!confId) return []
        return entry.files.map(async (file) => {
          const fd = new FormData()
          fd.append('file', file)
          await fetch(`/api/booking-confirmations/${confId}/file`, { method: 'POST', body: fd })
        })
      })

    await Promise.all(fileUploads)

    setSuccess('Booking confirmed! The employee has been notified.')
    const updated = await fetch(`/api/travel-requests/${id}`).then((r) => r.json())
    setRequest(updated)
    setSubmitting(false)
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!request) return <div className="p-8 text-red-500">Request not found.</div>

  const isUnassigned = !request.agentId && request.status === 'PENDING_AGENT'
  const canConfirm = ['PENDING_AGENT', 'APPROVED'].includes(request.status) && request.status !== 'BOOKING_CONFIRMED'
  const isAgentChooses = request.servicesRequested.includes('AGENT_CHOOSES')

  const budgetPct = request.event.budgetUsd > 0
    ? Math.round((Number(request.event.approvedSpendUsd) / Number(request.event.budgetUsd)) * 100)
    : 0

  const currentStep = STATUS_STEPS.indexOf(request.status)
  const isTerminal = ['REJECTED', 'CANCELLED'].includes(request.status)

  const confirmSections = isAgentChooses ? agentPickedServices : request.servicesRequested

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
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-start">
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

      {/* Request details */}
      <div className="rounded-xl border bg-white p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
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

      {/* Complete booking form */}
      {canConfirm && (
        <form onSubmit={handleConfirm} className="rounded-xl border-2 border-green-100 bg-green-50 p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-green-900">Complete booking</h2>
            <p className="text-xs text-green-700 mt-0.5">
              Fill in the confirmation details for each service. The employee will be notified.
            </p>
          </div>

          {/* For AGENT_CHOOSES: let agent pick which services they're confirming */}
          {isAgentChooses && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Which services did you book?</p>
              <div className="flex flex-wrap gap-2">
                {ALL_SERVICES.map((svc) => {
                  const picked = agentPickedServices.includes(svc)
                  const SvcIcon = SERVICE_ICON[svc] ?? PlusCircleIcon
                  return (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => toggleAgentService(svc)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        picked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      <SvcIcon className="w-4 h-4" /> {SERVICE_LABEL[svc]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Per-service sections */}
          {confirmSections.filter((s) => s !== 'AGENT_CHOOSES').map((svc) => {
            const entry = serviceEntries[svc] ?? emptyEntry()
            const SvcIcon = SERVICE_ICON[svc] ?? PlusCircleIcon
            return (
              <div key={svc} className="rounded-xl border border-green-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <SvcIcon className="w-5 h-5 text-gray-600 shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-800">{SERVICE_LABEL[svc] ?? svc}</h3>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Confirmation number</label>
                  <input
                    type="text"
                    placeholder="e.g. UA-2026-8472"
                    value={entry.confirmationNumber}
                    onChange={(e) => updateEntry(svc, 'confirmationNumber', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Documents (optional)</label>
                  <input
                    type="file"
                    accept="*/*"
                    title={`Upload document for ${SERVICE_LABEL[svc] ?? svc}`}
                    aria-label={`Upload document for ${SERVICE_LABEL[svc] ?? svc}`}
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[svc] = el }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) addFile(svc, f) }}
                  />
                  {entry.files.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {entry.files.map((file, i) => (
                        <div key={i} className="flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs text-indigo-700 max-w-[180px]">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(svc, i)}
                            aria-label="Remove file"
                            className="shrink-0 w-3.5 h-3.5 rounded-full bg-indigo-200 hover:bg-red-200 hover:text-red-700 flex items-center justify-center transition-colors"
                          >
                            <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[svc]?.click()}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {entry.files.length > 0 ? 'Add another file' : 'Upload file (PDF, image, any format)'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
                  <textarea
                    rows={2}
                    placeholder={`Notes about this ${SERVICE_LABEL[svc] ?? svc} booking…`}
                    value={entry.notes}
                    onChange={(e) => updateEntry(svc, 'notes', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  />
                </div>
              </div>
            )
          })}

          {confirmSections.length === 0 && isAgentChooses && (
            <p className="text-sm text-gray-400 text-center py-2">Select at least one service above.</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || (isAgentChooses && confirmSections.filter((s) => s !== 'AGENT_CHOOSES').length === 0)}
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Confirming…' : 'Confirm & notify employee →'}
            </button>
          </div>
        </form>
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
