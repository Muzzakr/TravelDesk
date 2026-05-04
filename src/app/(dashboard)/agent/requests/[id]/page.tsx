'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

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
}

interface BookingOption {
  id: string
  serviceType: string
  vendor: string
  description: string
  priceUsd: number
  isSelected: boolean
}

interface OptionRow {
  serviceType: string
  vendor: string
  description: string
  priceUsd: string
}

const STATUS_STEPS = [
  'DRAFT', 'SUBMITTED', 'PENDING_AGENT', 'OPTIONS_PROVIDED',
  'PENDING_MANAGER', 'APPROVED', 'BOOKING_CONFIRMED',
]

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_AGENT: 'With agent',
  OPTIONS_PROVIDED: 'Options provided',
  PENDING_MANAGER: 'Manager review',
  APPROVED: 'Approved',
  BOOKING_CONFIRMED: 'Booking confirmed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
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
  uber: 'https://www.uber.com',
  bolt: 'https://bolt.eu',
}

function getBookingUrl(vendor: string, serviceType: string, origin: string, destination: string, dates: { departureDate: string; returnDate: string }): string {
  const base = VENDOR_URLS[vendor.toLowerCase()]
  if (base) return base
  const q = encodeURIComponent(`${vendor} ${serviceType.replace('_', ' ')} ${origin} ${destination} ${dates.departureDate}`)
  return `https://www.google.com/search?q=${q}`
}

interface AiOption {
  vendor: string
  description: string
  priceUsd: number
}

interface AiResults {
  flights: AiOption[]
  hotels: AiOption[]
  cars: AiOption[]
  taxis: AiOption[]
}

export default function AgentRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [request, setRequest] = useState<TravelRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [options, setOptions] = useState<OptionRow[]>([
    { serviceType: '', vendor: '', description: '', priceUsd: '' },
  ])

  const [bookingTab, setBookingTab] = useState<'FLIGHT' | 'HOTEL' | 'CAR' | 'TAXI'>('FLIGHT')
  const [flightConfirmNo, setFlightConfirmNo] = useState('')
  const [flightNotes, setFlightNotes] = useState('')
  const [hotelConfirmNo, setHotelConfirmNo] = useState('')
  const [hotelNotes, setHotelNotes] = useState('')
  const [carConfirmNo, setCarConfirmNo] = useState('')
  const [carNotes, setCarNotes] = useState('')
  const [taxiConfirmNo, setTaxiConfirmNo] = useState('')
  const [taxiNotes, setTaxiNotes] = useState('')

  const [aiResults, setAiResults] = useState<AiResults | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [selectedAi, setSelectedAi] = useState<Record<string, boolean>>({})

  async function handleAiSearch() {
    setAiLoading(true)
    setAiError('')
    setAiResults(null)
    setSelectedAi({})
    const res = await fetch('/api/agent/ai-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ travelRequestId: id }),
    })
    if (res.ok) {
      const data: AiResults = await res.json()
      setAiResults(data)
      const initial: Record<string, boolean> = {}
      ;[...data.flights, ...data.hotels, ...data.cars, ...data.taxis].forEach((_, i) => { initial[i] = true })
      setSelectedAi(initial)
    } else {
      const data = await res.json().catch(() => ({}))
      setAiError(data.error ?? 'AI search failed. Check that OPENAI_API_KEY is set in .env and restart the dev server.')
    }
    setAiLoading(false)
  }

  async function saveAiOptions() {
    if (!aiResults) return
    setSubmitting(true)
    setError('')
    const all = [
      ...aiResults.flights.map((o) => ({ serviceType: 'FLIGHT', ...o })),
      ...aiResults.hotels.map((o) => ({ serviceType: 'HOTEL', ...o })),
      ...aiResults.cars.map((o) => ({ serviceType: 'CAR_RENTAL', ...o })),
      ...aiResults.taxis.map((o) => ({ serviceType: 'TAXI', ...o })),
    ]
    const chosen = all.filter((_, i) => selectedAi[i])
    if (chosen.length === 0) { setError('Select at least one option'); setSubmitting(false); return }
    const res = await fetch(`/api/travel-requests/${id}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: chosen }),
    })
    if (res.ok) {
      setSuccess('AI options saved. Status set to OPTIONS PROVIDED.')
      setAiResults(null)
      const updated = await fetch(`/api/travel-requests/${id}`).then((r) => r.json())
      setRequest(updated)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to save options')
    }
    setSubmitting(false)
  }

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((s) => setCurrentUserId(s?.user?.id ?? null))

    fetch(`/api/travel-requests/${id}`)
      .then((r) => r.json())
      .then((data) => { setRequest(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function handleAssign() {
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/travel-requests/${id}/assign`, { method: 'POST' })
    if (res.ok) {
      setSuccess('Booking assigned to you.')
      router.refresh()
      const updated = await fetch(`/api/travel-requests/${id}`).then((r) => r.json())
      setRequest(updated)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to assign')
    }
    setSubmitting(false)
  }

  async function handleSubmitOptions(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const payload = options.map((o) => ({
      serviceType: o.serviceType,
      vendor: o.vendor,
      description: o.description,
      priceUsd: parseFloat(o.priceUsd),
    }))
    const res = await fetch(`/api/travel-requests/${id}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: payload }),
    })
    if (res.ok) {
      setSuccess('Booking options submitted. Status set to OPTIONS PROVIDED.')
      const updated = await fetch(`/api/travel-requests/${id}`).then((r) => r.json())
      setRequest(updated)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to submit options')
    }
    setSubmitting(false)
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const activeNo = bookingTab === 'FLIGHT' ? flightConfirmNo : bookingTab === 'HOTEL' ? hotelConfirmNo : bookingTab === 'CAR' ? carConfirmNo : taxiConfirmNo
    const activeNotes = bookingTab === 'FLIGHT' ? flightNotes : bookingTab === 'HOTEL' ? hotelNotes : bookingTab === 'CAR' ? carNotes : taxiNotes
    const res = await fetch(`/api/travel-requests/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmationNumber: activeNo, notes: activeNotes }),
    })
    if (res.ok) {
      setSuccess('Booking confirmed!')
      const updated = await fetch(`/api/travel-requests/${id}`).then((r) => r.json())
      setRequest(updated)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to confirm')
    }
    setSubmitting(false)
  }

  function addOptionRow() {
    setOptions([...options, { serviceType: '', vendor: '', description: '', priceUsd: '' }])
  }

  function updateOption(index: number, field: keyof OptionRow, value: string) {
    setOptions(options.map((o, i) => (i === index ? { ...o, [field]: value } : o)))
  }

  function removeOption(index: number) {
    setOptions(options.filter((_, i) => i !== index))
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!request) return <div className="p-8 text-red-500">Request not found.</div>

  const isMyRequest = request.agentId === currentUserId
  const isUnassigned = !request.agentId && request.status === 'PENDING_AGENT'
  const canAddOptions = isMyRequest && ['PENDING_AGENT', 'OPTIONS_PROVIDED'].includes(request.status)
  const canConfirm = isMyRequest && ['APPROVED', 'OPTIONS_PROVIDED', 'PENDING_MANAGER'].includes(request.status)

  const budgetPct =
    request.event.budgetUsd > 0
      ? Math.round((Number(request.event.approvedSpendUsd) / Number(request.event.budgetUsd)) * 100)
      : 0

  const currentStep = STATUS_STEPS.indexOf(request.status)
  const isTerminal = ['REJECTED', 'CANCELLED'].includes(request.status)

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

      {/* Request details */}
      <div className="rounded-xl border bg-white p-6 grid grid-cols-2 gap-4 text-sm">
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
          <p className="text-gray-900">{request.servicesRequested.join(', ')}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Class / Est. cost</p>
          <p className="text-gray-900">
            {request.preferredClass}
            {request.estimatedCostUsd ? ` · $${Number(request.estimatedCostUsd).toFixed(0)}` : ''}
          </p>
        </div>
        {request.hotelNights && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Hotel nights</p>
            <p className="text-gray-900">{request.hotelNights}</p>
          </div>
        )}
        {request.carRentalDays && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Car rental days</p>
            <p className="text-gray-900">{request.carRentalDays}</p>
          </div>
        )}
        <div className="col-span-2">
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Purpose</p>
          <p className="text-gray-900">{request.purpose}</p>
        </div>
        {request.specialInstructions && (
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Special instructions</p>
            <p className="text-gray-700 whitespace-pre-wrap">{request.specialInstructions}</p>
          </div>
        )}
        {request.confirmationNumber && (
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Confirmation number</p>
            <p className="font-mono font-bold text-green-700">{request.confirmationNumber}</p>
          </div>
        )}
      </div>

      {/* Event budget */}
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs font-medium text-gray-400 uppercase mb-2">Event budget</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            {/* eslint-disable-next-line react/forbid-component-props */}
            <div
              className={`h-2 rounded-full ${budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
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

      {/* Existing options */}
      {request.bookingOptions && request.bookingOptions.length > 0 && (
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Booking options</h2>
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="py-2 text-left pr-4">Service</th>
                <th className="py-2 text-left pr-4">Vendor</th>
                <th className="py-2 text-left pr-4">Description</th>
                <th className="py-2 text-left pr-4">Price</th>
                <th className="py-2 text-left">Book</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {request.bookingOptions.map((opt) => (
                <tr key={opt.id} className={opt.isSelected ? 'bg-green-50' : ''}>
                  <td className="py-2 pr-4 font-medium text-gray-700">{opt.serviceType}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {opt.isSelected && <span className="mr-1 text-green-600">✓</span>}
                    {opt.vendor}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{opt.description}</td>
                  <td className="py-2 pr-4 text-gray-900">${Number(opt.priceUsd).toFixed(2)}</td>
                  <td className="py-2">
                    <a
                      href={getBookingUrl(opt.vendor, opt.serviceType, request.origin, request.destination, request.travelDates as { departureDate: string; returnDate: string })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      Book →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Search */}
      {canAddOptions && (
        <div className="rounded-xl border-2 border-indigo-100 bg-indigo-50 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-indigo-900">Search with AI</h2>
              <p className="text-xs text-indigo-700 mt-0.5">Claude searches flights, hotels and rental cars automatically and returns 3 options each.</p>
            </div>
            <button
              type="button"
              onClick={handleAiSearch}
              disabled={aiLoading}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
            >
              {aiLoading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Searching…
                </>
              ) : '✨ Search with AI'}
            </button>
          </div>

          {aiError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{aiError}</p>}

          {aiResults && (
            <div className="space-y-4">
              {([
                { label: 'Flights', key: 'flights', items: aiResults.flights, offset: 0 },
                { label: 'Hotels', key: 'hotels', items: aiResults.hotels, offset: aiResults.flights.length },
                { label: 'Rental Cars', key: 'cars', items: aiResults.cars, offset: aiResults.flights.length + aiResults.hotels.length },
                { label: 'Taxis', key: 'taxis', items: aiResults.taxis, offset: aiResults.flights.length + aiResults.hotels.length + aiResults.cars.length },
              ] as const).map(({ label, items, offset }) => (
                items.length > 0 && (
                  <div key={label} className="rounded-lg bg-white border border-indigo-100 p-4">
                    <p className="text-xs font-semibold uppercase text-indigo-600 tracking-wide mb-3">{label}</p>
                    <div className="space-y-2">
                      {items.map((opt, i) => {
                        const idx = offset + i
                        return (
                          <label key={i} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selectedAi[idx] ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
                            <input
                              type="checkbox"
                              checked={!!selectedAi[idx]}
                              onChange={(e) => setSelectedAi((prev) => ({ ...prev, [idx]: e.target.checked }))}
                              className="mt-0.5 accent-indigo-600"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{opt.vendor}</p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{opt.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <p className="text-sm font-bold text-indigo-700">${opt.priceUsd}</p>
                              <a
                                href={getBookingUrl(opt.vendor, label, request.origin, request.destination, request.travelDates as { departureDate: string; returnDate: string })}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                              >
                                Book →
                              </a>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              ))}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveAiOptions}
                  disabled={submitting}
                  className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Save selected options →'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/update options form */}
      {canAddOptions && (
        <form onSubmit={handleSubmitOptions} className="rounded-xl border bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">
            {request.bookingOptions?.length ? 'Update booking options' : 'Add booking options'}
          </h2>
          <p className="text-xs text-gray-500">Add up to 3 options per service type for the employee/manager to choose from.</p>

          {options.map((opt, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Service type</label>
                <select
                  title="Service type"
                  required
                  value={opt.serviceType}
                  onChange={(e) => updateOption(i, 'serviceType', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select...</option>
                  <option value="FLIGHT">Flight</option>
                  <option value="HOTEL">Hotel</option>
                  <option value="CAR_RENTAL">Car rental</option>
                  <option value="TAXI">Taxi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Vendor</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. SAS, Scandic"
                  value={opt.vendor}
                  onChange={(e) => updateOption(i, 'vendor', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Economy 08:00 ARN-CPH"
                  value={opt.description}
                  onChange={(e) => updateOption(i, 'description', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Price (USD)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={opt.priceUsd}
                    onChange={(e) => updateOption(i, 'priceUsd', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="self-end mb-0.5 text-gray-400 hover:text-red-500 text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            {options.length < 9 && (
              <button
                type="button"
                onClick={addOptionRow}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Add another option
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="ml-auto rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit options'}
            </button>
          </div>
        </form>
      )}

      {/* Confirm booking form */}
      {canConfirm && request.status !== 'BOOKING_CONFIRMED' && (
        <form onSubmit={handleConfirm} className="rounded-xl border bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Confirm booking</h2>

          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {([
              { key: 'FLIGHT', label: '✈ Flight' },
              { key: 'HOTEL', label: '🏨 Hotel' },
              { key: 'CAR', label: '🚗 Car' },
              { key: 'TAXI', label: '🚕 Taxi' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setBookingTab(key)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                  bookingTab === key
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Flight fields */}
          {bookingTab === 'FLIGHT' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Confirmation number</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. SK-2026-8472"
                  value={flightConfirmNo}
                  onChange={(e) => setFlightConfirmNo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Any additional flight booking notes..."
                  value={flightNotes}
                  onChange={(e) => setFlightNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {/* Hotel fields */}
          {bookingTab === 'HOTEL' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Confirmation number</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. HTL-2026-3310"
                  value={hotelConfirmNo}
                  onChange={(e) => setHotelConfirmNo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Any additional hotel booking notes..."
                  value={hotelNotes}
                  onChange={(e) => setHotelNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {/* Car rental fields */}
          {bookingTab === 'CAR' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Confirmation number</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. CAR-2026-7791"
                  value={carConfirmNo}
                  onChange={(e) => setCarConfirmNo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Any additional car rental notes..."
                  value={carNotes}
                  onChange={(e) => setCarNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {/* Taxi fields */}
          {bookingTab === 'TAXI' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Confirmation number</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. TAXI-2026-4421"
                  value={taxiConfirmNo}
                  onChange={(e) => setTaxiConfirmNo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Any additional taxi notes..."
                  value={taxiNotes}
                  onChange={(e) => setTaxiNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Confirming...' : 'Confirm booking'}
            </button>
          </div>
        </form>
      )}

      {request.status === 'BOOKING_CONFIRMED' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Booking confirmed — {request.confirmationNumber}
          </p>
        </div>
      )}
    </div>
  )
}
