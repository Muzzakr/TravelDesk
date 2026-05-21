'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { TravelEvent } from '@/types/event'
import { AIRPORTS, HOTEL_CITIES, TRAVEL_LOCATIONS, type AirportOption } from '@/lib/travel-locations'
import { DateInput } from '@/components/ui/DateInput'
import { PaperAirplaneIcon, BuildingOfficeIcon, TruckIcon, MapPinIcon, UserGroupIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'
type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = { id: string; name: string; email: string }
type FlightData = {
  originAirport: AirportOption | null
  destAirport: AirportOption | null
  tripType: 'one-way' | 'round-trip'
  departureDate: string; departureTime: string
  returnDate: string; returnTime: string
  flexibleDates: boolean; notes: string
}
type HotelData = { city: string; checkIn: string; checkOut: string; area: string; notes: string }
type TaxiData  = { pickup: string; dropoff: string; date: string; time: string; notes: string }
type CarData   = { pickupCity: string; pickupDate: string; pickupTime: string; returnDate: string; returnTime: string; vehicleType: string; notes: string }
type AiOption  = { vendor: string; description: string; priceUsd: number }
type AiResults = { flights: AiOption[]; hotels: AiOption[]; cars: AiOption[]; taxis: AiOption[] }

const SERVICE_MAPPING = [
  { key: 'flights' as const, type: 'FLIGHT'     as const, Icon: PaperAirplaneIcon,  label: 'Flights'     },
  { key: 'hotels'  as const, type: 'HOTEL'      as const, Icon: BuildingOfficeIcon, label: 'Hotels'      },
  { key: 'cars'    as const, type: 'CAR_RENTAL' as const, Icon: TruckIcon,          label: 'Car Rentals' },
  { key: 'taxis'   as const, type: 'TAXI'       as const, Icon: MapPinIcon,         label: 'Taxis'       },
]

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls = 'rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white'

// ─── Small components ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button" role="switch" aria-checked={checked ? 'true' : 'false'} aria-label={label} title={label}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${checked ? 'bg-indigo-600' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  )
}

function AirportCombobox({ value, onChange, placeholder, label, required }: {
  value: AirportOption | null; onChange: (a: AirportOption | null) => void
  placeholder: string; label: string; required?: boolean
}) {
  const [query, setQuery]     = useState(value ? `${value.name} (${value.code})` : '')
  const [open, setOpen]       = useState(false)
  const [results, setResults] = useState<AirportOption[]>([])

  function handleInput(q: string) {
    setQuery(q); onChange(null)
    if (q.length >= 1) {
      const lower = q.toLowerCase()
      const filtered = AIRPORTS.filter(a =>
        a.code.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower) || a.city.toLowerCase().includes(lower)
      ).slice(0, 8)
      setResults(filtered); setOpen(filtered.length > 0)
    } else { setOpen(false) }
  }

  function select(airport: AirportOption) {
    onChange(airport); setQuery(`${airport.name} (${airport.code})`); setOpen(false)
  }

  return (
    <div className="relative flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type="text" value={query} onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (query.length >= 1 && results.length > 0) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder} autoComplete="off" className={inputCls} />
      {open && (
        <div className="absolute top-full mt-1 w-full z-50 bg-white rounded-xl border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
          {results.map(a => (
            <button key={a.code} type="button" onMouseDown={() => select(a)}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 flex items-center justify-between gap-2 text-sm border-b border-gray-50 last:border-0">
              <span>
                <span className="font-medium text-gray-900">{a.name}</span>
                <span className="text-gray-400 ml-1 text-xs">· {a.city}, {a.country}</span>
              </span>
              <span className="text-xs font-bold text-indigo-600 shrink-0">{a.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SearchCombobox({ value, onChange, suggestions, placeholder, label, required }: {
  value: string; onChange: (v: string) => void; suggestions: string[]
  placeholder: string; label: string; required?: boolean
}) {
  const [open, setOpen]       = useState(false)
  const [results, setResults] = useState<string[]>([])

  function handleInput(q: string) {
    onChange(q)
    if (q.length >= 1) {
      const lower = q.toLowerCase()
      const filtered = suggestions.filter(s => s.toLowerCase().includes(lower)).slice(0, 8)
      setResults(filtered); setOpen(filtered.length > 0)
    } else { setOpen(false) }
  }

  return (
    <div className="relative flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type="text" value={value} onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (value.length >= 1 && results.length > 0) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder} autoComplete="off" className={inputCls} />
      {open && (
        <div className="absolute top-full mt-1 w-full z-50 bg-white rounded-xl border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
          {results.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => { onChange(s); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm text-gray-800 border-b border-gray-50 last:border-0">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

function ProgressBar({ step }: { step: number }) {
  const steps = ['Employee', 'Services', 'Details', 'Review', 'Options']
  return (
    <div className="flex items-center mb-8">
      {steps.map((label, i) => {
        const n = i + 1; const done = step > n; const active = step === n
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-indigo-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`mt-1 text-xs font-medium hidden sm:block ${active ? 'text-indigo-600' : done ? 'text-indigo-400' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${step > n ? 'bg-indigo-400' : 'bg-gray-200'}`} />}
          </div>
        )
      })}
    </div>
  )
}

function EventCombobox({ value, onChange, events }: {
  value: TravelEvent | null
  onChange: (ev: TravelEvent | null) => void
  events: TravelEvent[]
}) {
  const [query, setQuery] = useState(value ? value.eventName : '')
  const [open, setOpen]   = useState(false)
  const [results, setResults] = useState<TravelEvent[]>([])

  function handleInput(q: string) {
    setQuery(q)
    onChange(null)
    const lower = q.toLowerCase()
    const filtered = q.length === 0
      ? events.slice(0, 8)
      : events.filter(e =>
          e.eventName.toLowerCase().includes(lower) ||
          (e.eventCode ?? '').toLowerCase().includes(lower)
        ).slice(0, 8)
    setResults(filtered)
    setOpen(filtered.length > 0)
  }

  function handleFocus() {
    const filtered = query.length === 0 ? events.slice(0, 8) : results
    setResults(filtered)
    setOpen(filtered.length > 0)
  }

  function select(ev: TravelEvent) {
    onChange(ev)
    setQuery(ev.eventName)
    setOpen(false)
  }

  return (
    <div className="relative flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">Event<span className="text-red-500 ml-0.5">*</span></label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search events…"
          autoComplete="off"
          className={inputCls}
        />
        {value && (
          <button
            type="button"
            onMouseDown={() => { onChange(null); setQuery(''); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear event"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <div className="absolute top-full mt-1 w-full z-50 bg-white rounded-xl border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-400 text-center">No events found</p>
          ) : results.map(ev => (
            <button
              key={ev.id}
              type="button"
              onMouseDown={() => select(ev)}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 flex items-start justify-between gap-2 text-sm border-b border-gray-50 last:border-0"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{ev.eventName}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {ev.eventCode && <span className="font-mono">{ev.eventCode}</span>}
                  {` · ${fmtDisplayDate(new Date(ev.dateStart).toISOString().split('T')[0])}`}
                </p>
              </div>
              {ev.id === value?.id && (
                <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
      {value && (
        <p className="text-xs text-gray-500 mt-0.5">
          {value.eventCode && <span className="font-mono font-medium text-indigo-600">{value.eventCode}</span>}
          {` · ${fmtDisplayDate(new Date(value.dateStart).toISOString().split('T')[0])}`}
        </p>
      )}
    </div>
  )
}

function ServiceHeader({ Icon, title }: { Icon: HeroIcon; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-indigo-50 border-l-4 border-indigo-600 px-4 py-3 mb-5">
      <Icon className="w-6 h-6 text-indigo-600 shrink-0" />
      <span className="font-semibold text-indigo-900">{title}</span>
    </div>
  )
}

function ReviewBlock({ Icon, title, onEdit, children }: { Icon: HeroIcon; title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-semibold text-gray-800">{title}</span>
        </div>
        <button type="button" onClick={onEdit} className="text-xs text-indigo-600 font-medium hover:underline">Edit</button>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-400 w-32 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  )
}

function fmtDisplayDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

// ─── Main page ────────────────────────────────────────────────────────────────

const SERVICE_META: Record<string, { Icon: HeroIcon; label: string }> = {
  FLIGHT:     { Icon: PaperAirplaneIcon,  label: 'Flight' },
  HOTEL:      { Icon: BuildingOfficeIcon, label: 'Hotel' },
  CAR_RENTAL: { Icon: TruckIcon,          label: 'Car Rental' },
  TAXI:       { Icon: MapPinIcon,         label: 'Taxi / Transfer' },
}

export default function AgentBookPage() {
  const router = useRouter()

  const [step, setStep]           = useState(1)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [events, setEvents]       = useState<TravelEvent[]>([])
  const [eventId, setEventId]     = useState('')
  const [selectedEvent, setSelectedEvent] = useState<TravelEvent | null>(null)
  const [services, setServices]   = useState<string[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [warning, setWarning]     = useState('')

  const [createdRequestId, setCreatedRequestId]   = useState<string | null>(null)
  const [aiOptions, setAiOptions]                 = useState<AiResults | null>(null)
  const [selectedOptionKeys, setSelectedOptionKeys] = useState<Set<string>>(new Set())
  const [aiLoading, setAiLoading]                 = useState(false)
  const [aiError, setAiError]                     = useState<string | null>(null)
  const [confirmingOptions, setConfirmingOptions] = useState(false)

  const [flight, setFlight] = useState<FlightData>({
    originAirport: null, destAirport: null, tripType: 'round-trip',
    departureDate: '', departureTime: '', returnDate: '', returnTime: '',
    flexibleDates: false, notes: '',
  })
  const [hotel, setHotel] = useState<HotelData>({ city: '', checkIn: '', checkOut: '', area: '', notes: '' })
  const [taxi, setTaxi]   = useState<TaxiData>({ pickup: '', dropoff: '', date: '', time: '', notes: '' })
  const [car, setCar]     = useState<CarData>({ pickupCity: '', pickupDate: '', pickupTime: '', returnDate: '', returnTime: '', vehicleType: '', notes: '' })
  const [purpose, setPurpose]                   = useState('')
  const [estimatedCostUsd, setEstimatedCostUsd] = useState('')
  const [paymentResponsibility, setPaymentResponsibility] = useState('m4u')

  useEffect(() => {
    Promise.all([
      fetch('/api/agent/employees').then(r => r.json()),
      fetch('/api/events').then(r => r.json()),
    ]).then(([emps, evts]: [Employee[], TravelEvent[]]) => {
      setEmployees(emps)
      const active = evts.filter(e => e.status !== 'CLOSED')
      setEvents(active)

      // Pre-fill from inbox query params
      const p = new URLSearchParams(window.location.search)
      const inboxService  = p.get('service')
      const inboxDest     = p.get('destination')
      const inboxOrigin   = p.get('origin')
      const inboxDep      = p.get('departure')
      const inboxRet      = p.get('return')
      const inboxEmployee = p.get('employee')

      if (inboxService) {
        setServices([inboxService])
        if (inboxService === 'FLIGHT') {
          setFlight(f => ({
            ...f,
            departureDate: inboxDep ?? '',
            returnDate:    inboxRet ?? '',
          }))
        } else if (inboxService === 'HOTEL') {
          setHotel(h => ({ ...h, city: inboxDest ?? '', checkIn: inboxDep ?? '', checkOut: inboxRet ?? '' }))
        } else if (inboxService === 'CAR_RENTAL') {
          setCar(c => ({ ...c, pickupCity: inboxDest ?? inboxOrigin ?? '', pickupDate: inboxDep ?? '', returnDate: inboxRet ?? '' }))
        } else if (inboxService === 'TAXI') {
          setTaxi(t => ({ ...t, pickup: inboxOrigin ?? '', dropoff: inboxDest ?? '', date: inboxDep ?? '' }))
        }
      }

      if (inboxEmployee) {
        const match = emps.find(e => e.name.toLowerCase().includes(inboxEmployee.toLowerCase()))
        if (match) setEmployeeId(match.id)
      }
    })
  }, [])

  function selectEvent(ev: TravelEvent) { setEventId(ev.id); setSelectedEvent(ev) }
  function toggleService(s: string) {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function validate(): string {
    if (step === 1) {
      if (!employeeId) return 'Please select an employee.'
      if (!eventId)    return 'Please select an event.'
    }
    if (step === 2 && services.length === 0) return 'Please select at least one service.'
    if (step === 3) {
      if (services.includes('FLIGHT')) {
        if (!flight.originAirport)                                   return 'Please select a departure airport.'
        if (!flight.destAirport)                                     return 'Please select a destination airport.'
        if (!flight.departureDate)                                   return 'Please select a departure date.'
        if (flight.tripType === 'round-trip' && !flight.returnDate) return 'Please select a return date.'
      }
      if (services.includes('HOTEL')) {
        if (!hotel.city)     return 'Please enter a hotel city.'
        if (!hotel.checkIn)  return 'Please select a check-in date.'
        if (!hotel.checkOut) return 'Please select a check-out date.'
      }
      if (services.includes('TAXI')) {
        if (!taxi.pickup)  return 'Please enter a pickup location.'
        if (!taxi.dropoff) return 'Please enter a drop-off location.'
        if (!taxi.date)    return 'Please select a pickup date.'
        if (!taxi.time)    return 'Please select a pickup time.'
      }
      if (services.includes('CAR_RENTAL')) {
        if (!car.pickupCity) return 'Please enter a pickup location.'
        if (!car.pickupDate) return 'Please select a pickup date.'
        if (!car.returnDate) return 'Please select a return date.'
      }
      if (!purpose.trim()) return 'Please describe the purpose of the trip.'
    }
    return ''
  }

  function next() {
    const err = validate()
    if (err) { setError(err); return }
    setError(''); setStep(s => s + 1)
  }

  function back() { setError(''); setStep(s => s - 1) }

  async function submit() {
    setLoading(true); setError(''); setWarning('')

    const parts: string[] = []
    if (services.includes('FLIGHT') && flight.originAirport && flight.destAirport) {
      const depStr = `${flight.departureDate}${flight.departureTime ? ' at ' + flight.departureTime : ''}`
      const retStr = flight.tripType === 'round-trip'
        ? `, ret: ${flight.returnDate}${flight.returnTime ? ' at ' + flight.returnTime : ''}`
        : ' (one-way)'
      parts.push(`FLIGHT: ${flight.originAirport.name} (${flight.originAirport.code}) → ${flight.destAirport.name} (${flight.destAirport.code}), dep: ${depStr}${retStr}${flight.flexibleDates ? ', flexible dates' : ''}${flight.notes ? ', notes: ' + flight.notes : ''}`)
    }
    if (services.includes('HOTEL')) {
      parts.push(`HOTEL: ${hotel.city}${hotel.area ? ', area: ' + hotel.area : ''}, check-in: ${hotel.checkIn}, check-out: ${hotel.checkOut}${hotel.notes ? ', notes: ' + hotel.notes : ''}`)
    }
    if (services.includes('TAXI')) {
      parts.push(`TAXI: ${taxi.pickup} → ${taxi.dropoff}, ${taxi.date}${taxi.time ? ' at ' + taxi.time : ''}${taxi.notes ? ', notes: ' + taxi.notes : ''}`)
    }
    if (services.includes('CAR_RENTAL')) {
      parts.push(`CAR: pickup ${car.pickupCity} ${car.pickupDate}${car.pickupTime ? ' at ' + car.pickupTime : ''}, return ${car.returnDate}${car.returnTime ? ' at ' + car.returnTime : ''}${car.vehicleType ? ', vehicle: ' + car.vehicleType : ''}${car.notes ? ', notes: ' + car.notes : ''}`)
    }
    parts.push(`Payment: ${paymentResponsibility === 'client' ? 'Client is paying' : 'M4U is paying'}`)

    const origin      = flight.originAirport?.city || taxi.pickup || car.pickupCity || 'TBD'
    const destination = flight.destAirport?.city   || hotel.city  || taxi.dropoff   || car.pickupCity || 'TBD'
    const depDate     = flight.departureDate || taxi.date || hotel.checkIn || car.pickupDate || ''
    const retDate     = flight.tripType === 'one-way' ? '' : (flight.returnDate || hotel.checkOut || car.returnDate || '')

    function daysBetween(a: string, b: string) {
      if (!a || !b) return undefined
      const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
      return d > 0 ? d : undefined
    }

    const res = await fetch('/api/agent/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId,
        eventId,
        origin,
        destination,
        travelDates:         { departureDate: depDate, returnDate: retDate },
        servicesRequested:   services,
        purpose,
        estimatedCostUsd:    estimatedCostUsd ? Number(estimatedCostUsd) : undefined,
        preferredClass:      'ECONOMY',
        hotelNights:         services.includes('HOTEL')      ? daysBetween(hotel.checkIn, hotel.checkOut) : undefined,
        carRentalDays:       services.includes('CAR_RENTAL') ? daysBetween(car.pickupDate, car.returnDate) : undefined,
        specialInstructions: parts.join('\n'),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Submission failed. Please try again.')
      setLoading(false)
      return
    }
    if (data.budgetWarning) setWarning('Note: this request is approaching the event budget cap.')
    // If this booking originated from an inbox message, link it back
    const inboxId = new URLSearchParams(window.location.search).get('inbox_id')
    if (inboxId) {
      fetch(`/api/inbox/${inboxId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ travelRequestId: data.id, status: 'IN_PROGRESS' }),
      }).catch(() => {})
    }
    setCreatedRequestId(data.id)
    setLoading(false)
    setStep(5)
    fetchAiOptions(data.id)
  }

  async function fetchAiOptions(requestId: string) {
    setAiLoading(true); setAiError(null)
    try {
      const res = await fetch('/api/agent/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ travelRequestId: requestId }),
      })
      if (!res.ok) throw new Error('Failed')
      setAiOptions(await res.json())
    } catch {
      setAiError('Could not load AI options. You can still proceed.')
    }
    setAiLoading(false)
  }

  function toggleOptionKey(key: string) {
    setSelectedOptionKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function confirmOptions() {
    setConfirmingOptions(true)
    const chosen: { serviceType: string; vendor: string; description: string; priceUsd: number }[] = []
    for (const { key, type } of SERVICE_MAPPING) {
      ;(aiOptions?.[key] ?? []).forEach((opt, i) => {
        if (selectedOptionKeys.has(`${type}-${i}`)) {
          chosen.push({ serviceType: type, vendor: opt.vendor, description: opt.description, priceUsd: opt.priceUsd })
        }
      })
    }
    if (chosen.length > 0) {
      const res = await fetch(`/api/travel-requests/${createdRequestId}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: chosen }),
      })
      if (!res.ok) {
        setAiError('Failed to save selected options. Please try again.')
        setConfirmingOptions(false)
        return
      }
    }
    router.push(`/agent/requests/${createdRequestId}`)
  }

  const selectedEmployee = employees.find(e => e.id === employeeId)

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Book on behalf of employee</h1>

      <ProgressBar step={step} />

      <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">

        {/* ─── Step 1: Employee + Event ────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Select employee</h2>
              <p className="text-sm text-gray-500 mb-4">Choose the employee you are booking for.</p>
              <Field label="Employee" required>
                <select
                  value={employeeId}
                  title="Employee"
                  onChange={e => setEmployeeId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select employee…</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} — {emp.email}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="h-px bg-gray-100" />

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Select event</h2>
              <p className="text-sm text-gray-500 mb-4">Choose the event this trip is for.</p>
              <EventCombobox value={selectedEvent} onChange={(ev) => { setSelectedEvent(ev); setEventId(ev?.id ?? '') }} events={events} />
            </div>
          </div>
        )}

        {/* ─── Step 2: Select Services ──────────────────────── */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">What do you need?</h2>
            <p className="text-sm text-gray-500 mb-5">Select all services for this trip. You can choose multiple.</p>
            <div className="grid grid-cols-2 gap-3">
              {(['FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TAXI'] as const).map(svc => {
                const meta = SERVICE_META[svc]; const sel = services.includes(svc)
                return (
                  <button key={svc} type="button" onClick={() => toggleService(svc)}
                    className={`rounded-2xl border-2 p-5 flex flex-col items-center gap-2 transition-all ${sel ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white hover:border-indigo-300 text-gray-700'}`}
                  >
                    <meta.Icon className="w-8 h-8" />
                    <span className="text-sm font-semibold">{meta.label}</span>
                    {sel && (
                      <div className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Step 3: Service Forms ────────────────────────── */}
        {step === 3 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Fill in details</h2>
              <p className="text-sm text-gray-500">Complete the information for each service.</p>
            </div>

            {services.includes('FLIGHT') && (
              <section className="space-y-4">
                <ServiceHeader Icon={PaperAirplaneIcon} title="Flight" />
                <div className="grid grid-cols-2 gap-3">
                  {(['one-way', 'round-trip'] as const).map(type => (
                    <button key={type} type="button" onClick={() => setFlight(f => ({ ...f, tripType: type }))}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${flight.tripType === type ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200'}`}>
                      {type === 'one-way' ? <PaperAirplaneIcon className="w-5 h-5" /> : <span>↔️</span>}
                      <span>{type === 'one-way' ? 'One-way' : 'Round Trip'}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AirportCombobox label="Departure Airport" required placeholder="Search city or IATA code…" value={flight.originAirport} onChange={v => setFlight(f => ({ ...f, originAirport: v }))} />
                  <AirportCombobox label="Destination Airport" required placeholder="Search city or IATA code…" value={flight.destAirport} onChange={v => setFlight(f => ({ ...f, destAirport: v }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Departure Date" required>
                    <DateInput title="Departure Date" value={flight.departureDate} onChange={v => setFlight(f => ({ ...f, departureDate: v }))} className={inputCls} />
                  </Field>
                  <Field label="Departure Time">
                    <input type="time" title="Departure Time" value={flight.departureTime} onChange={e => setFlight(f => ({ ...f, departureTime: e.target.value }))} className={inputCls} />
                  </Field>
                </div>
                {flight.tripType === 'round-trip' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Return Date" required>
                      <DateInput title="Return Date" value={flight.returnDate} onChange={v => setFlight(f => ({ ...f, returnDate: v }))} className={inputCls} />
                    </Field>
                    <Field label="Return Time">
                      <input type="time" title="Return Time" value={flight.returnTime} onChange={e => setFlight(f => ({ ...f, returnTime: e.target.value }))} className={inputCls} />
                    </Field>
                  </div>
                )}
                <Toggle checked={flight.flexibleDates} onChange={v => setFlight(f => ({ ...f, flexibleDates: v }))} label="Flexible dates" />
                <Field label="Additional Notes">
                  <textarea value={flight.notes} onChange={e => setFlight(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="E.g. aisle seat preferred…" className={inputCls + ' resize-none'} />
                </Field>
              </section>
            )}

            {services.includes('HOTEL') && (
              <section className="space-y-4">
                <ServiceHeader Icon={BuildingOfficeIcon} title="Hotel" />
                <SearchCombobox label="City" required value={hotel.city} onChange={v => setHotel(h => ({ ...h, city: v }))} suggestions={HOTEL_CITIES} placeholder="Search city…" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Check-in Date" required>
                    <DateInput title="Check-in Date" value={hotel.checkIn} onChange={v => setHotel(h => ({ ...h, checkIn: v }))} className={inputCls} />
                  </Field>
                  <Field label="Check-out Date" required>
                    <DateInput title="Check-out Date" value={hotel.checkOut} onChange={v => setHotel(h => ({ ...h, checkOut: v }))} className={inputCls} />
                  </Field>
                </div>
                <div className="flex flex-col gap-2">
                  <Field label="Preferred Area">
                    <input type="text" value={hotel.area} onChange={e => setHotel(h => ({ ...h, area: e.target.value }))} placeholder="E.g. City Center, Near Airport…" className={inputCls} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {['City Center', 'Near Airport', 'Near Venue'].map(chip => (
                      <button key={chip} type="button" onClick={() => setHotel(h => ({ ...h, area: chip }))}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${hotel.area === chip ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}>
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Notes">
                  <textarea value={hotel.notes} onChange={e => setHotel(h => ({ ...h, notes: e.target.value }))} rows={2} placeholder="Any special requests…" className={inputCls + ' resize-none'} />
                </Field>
              </section>
            )}

            {services.includes('TAXI') && (
              <section className="space-y-4">
                <ServiceHeader Icon={MapPinIcon} title="Taxi / Transfer" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SearchCombobox label="Pickup Location" required value={taxi.pickup} onChange={v => setTaxi(t => ({ ...t, pickup: v }))} suggestions={TRAVEL_LOCATIONS} placeholder="Search location…" />
                  <SearchCombobox label="Drop-off Location" required value={taxi.dropoff} onChange={v => setTaxi(t => ({ ...t, dropoff: v }))} suggestions={TRAVEL_LOCATIONS} placeholder="Search location…" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Date" required>
                    <DateInput title="Date" value={taxi.date} onChange={v => setTaxi(t => ({ ...t, date: v }))} className={inputCls} />
                  </Field>
                  <Field label="Time" required>
                    <input type="time" title="Time" value={taxi.time} onChange={e => setTaxi(t => ({ ...t, time: e.target.value }))} className={inputCls} />
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea value={taxi.notes} onChange={e => setTaxi(t => ({ ...t, notes: e.target.value }))} rows={2} placeholder="Any special requirements…" className={inputCls + ' resize-none'} />
                </Field>
              </section>
            )}

            {services.includes('CAR_RENTAL') && (
              <section className="space-y-4">
                <ServiceHeader Icon={TruckIcon} title="Car Rental" />
                <Field label="Type of vehicle">
                  <select title="Type of vehicle" value={car.vehicleType} onChange={e => setCar(c => ({ ...c, vehicleType: e.target.value }))} className={inputCls}>
                    <option value="">Select type…</option>
                    <option value="Economy">Economy</option>
                    <option value="Compact">Compact</option>
                    <option value="SUV">SUV</option>
                    <option value="Van">Van</option>
                    <option value="Minibus">Minibus</option>
                    <option value="Luxury">Luxury</option>
                  </select>
                </Field>
                <SearchCombobox label="Pickup Location" required value={car.pickupCity} onChange={v => setCar(c => ({ ...c, pickupCity: v }))} suggestions={TRAVEL_LOCATIONS} placeholder="Search location…" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Pickup Date" required>
                    <DateInput title="Pickup Date" value={car.pickupDate} onChange={v => setCar(c => ({ ...c, pickupDate: v }))} className={inputCls} />
                  </Field>
                  <Field label="Pickup Time">
                    <input type="time" title="Pickup Time" value={car.pickupTime} onChange={e => setCar(c => ({ ...c, pickupTime: e.target.value }))} className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Return Date" required>
                    <DateInput title="Return Date" value={car.returnDate} onChange={v => setCar(c => ({ ...c, returnDate: v }))} className={inputCls} />
                  </Field>
                  <Field label="Return Time">
                    <input type="time" title="Return Time" value={car.returnTime} onChange={e => setCar(c => ({ ...c, returnTime: e.target.value }))} className={inputCls} />
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea value={car.notes} onChange={e => setCar(c => ({ ...c, notes: e.target.value }))} rows={2} placeholder="Any special requirements…" className={inputCls + ' resize-none'} />
                </Field>
              </section>
            )}

            <section className="space-y-4">
              <div className="h-px bg-gray-100" />
              <Field label="Purpose of trip" required>
                <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={3} placeholder="E.g. Client visit — Q3 review meeting in London" className={inputCls + ' resize-none'} />
              </Field>
              <Field label="Estimated cost (USD)">
                <input type="number" min="0" value={estimatedCostUsd} onChange={e => setEstimatedCostUsd(e.target.value)} placeholder="0" className={inputCls} />
              </Field>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Payment Responsibility</p>
                <p className="text-xs text-gray-400 mb-3">Who is covering the cost of this trip?</p>
                <div className="grid grid-cols-2 gap-3">
                  {([['m4u', 'M4U is paying'], ['client', 'Client is paying']] as [string, string][]).map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setPaymentResponsibility(val)}
                      className={`flex items-center justify-center rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${paymentResponsibility === val ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ─── Step 4: Review & Submit ──────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Review your request</h2>
              <p className="text-sm text-gray-500">Double-check everything before submitting.</p>
            </div>

            {selectedEmployee && (
              <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Employee</p>
                <p className="font-semibold text-gray-900">{selectedEmployee.name}</p>
                <p className="text-sm text-gray-500">{selectedEmployee.email}</p>
              </div>
            )}

            {selectedEvent && (
              <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Event</p>
                <p className="font-semibold text-gray-900">{selectedEvent.eventName}</p>
                <p className="text-sm text-gray-500">
                  {selectedEvent.eventCode}
                  {` · ${fmtDisplayDate(new Date(selectedEvent.dateStart).toISOString().split('T')[0])}`}
                </p>
              </div>
            )}

            {services.includes('FLIGHT') && flight.originAirport && flight.destAirport && (
              <ReviewBlock Icon={PaperAirplaneIcon} title="Flight" onEdit={() => setStep(3)}>
                <ReviewRow label="Route"     value={`${flight.originAirport.name} (${flight.originAirport.code}) → ${flight.destAirport.name} (${flight.destAirport.code})`} />
                <ReviewRow label="Trip type" value={flight.tripType === 'one-way' ? 'One-way' : 'Round trip'} />
                <ReviewRow label="Departure" value={`${fmtDisplayDate(flight.departureDate)}${flight.departureTime ? ' at ' + flight.departureTime : ''}`} />
                {flight.tripType === 'round-trip' && (
                  <ReviewRow label="Return" value={`${fmtDisplayDate(flight.returnDate)}${flight.returnTime ? ' at ' + flight.returnTime : ''}`} />
                )}
                {flight.flexibleDates && <ReviewRow label="Flexible dates" value="Yes" />}
                {flight.notes && <ReviewRow label="Notes" value={flight.notes} />}
              </ReviewBlock>
            )}

            {services.includes('HOTEL') && (
              <ReviewBlock Icon={BuildingOfficeIcon} title="Hotel" onEdit={() => setStep(3)}>
                <ReviewRow label="City"      value={hotel.city || '—'} />
                <ReviewRow label="Check-in"  value={fmtDisplayDate(hotel.checkIn)} />
                <ReviewRow label="Check-out" value={fmtDisplayDate(hotel.checkOut)} />
                {hotel.area  && <ReviewRow label="Area"  value={hotel.area} />}
                {hotel.notes && <ReviewRow label="Notes" value={hotel.notes} />}
              </ReviewBlock>
            )}

            {services.includes('TAXI') && (
              <ReviewBlock Icon={MapPinIcon} title="Taxi / Transfer" onEdit={() => setStep(3)}>
                <ReviewRow label="Pickup"      value={taxi.pickup || '—'} />
                <ReviewRow label="Drop-off"    value={taxi.dropoff || '—'} />
                <ReviewRow label="Date & time" value={taxi.date ? `${fmtDisplayDate(taxi.date)}${taxi.time ? ' at ' + taxi.time : ''}` : '—'} />
                {taxi.notes && <ReviewRow label="Notes" value={taxi.notes} />}
              </ReviewBlock>
            )}

            {services.includes('CAR_RENTAL') && (
              <ReviewBlock Icon={TruckIcon} title="Car Rental" onEdit={() => setStep(3)}>
                <ReviewRow label="Pickup"      value={car.pickupCity || '—'} />
                {car.vehicleType && <ReviewRow label="Vehicle type" value={car.vehicleType} />}
                <ReviewRow label="Pickup date" value={`${fmtDisplayDate(car.pickupDate)}${car.pickupTime ? ' at ' + car.pickupTime : ''}`} />
                <ReviewRow label="Return date" value={`${fmtDisplayDate(car.returnDate)}${car.returnTime ? ' at ' + car.returnTime : ''}`} />
                {car.notes && <ReviewRow label="Notes" value={car.notes} />}
              </ReviewBlock>
            )}

            <ReviewBlock Icon={PlusCircleIcon} title="Trip details" onEdit={() => setStep(3)}>
              <ReviewRow label="Purpose"  value={purpose || '—'} />
              {estimatedCostUsd && <ReviewRow label="Est. cost" value={`$${Number(estimatedCostUsd).toLocaleString('en-US')}`} />}
              <ReviewRow label="Payment"  value={paymentResponsibility === 'client' ? 'Client is paying' : 'M4U is paying'} />
            </ReviewBlock>

            {warning && <p className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">{warning}</p>}
            {error   && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</p>}
          </div>
        )}

        {error && step < 4 && (
          <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</p>
        )}

        {/* ─── Step 5: AI Options ───────────────────────────── */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Select travel options</h2>
              <p className="text-sm text-gray-500">Choose the options to send to the employee for approval. You can select multiple.</p>
            </div>

            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <p className="text-sm text-gray-500">Generating AI options…</p>
              </div>
            )}

            {aiError && (
              <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 flex items-center justify-between gap-3">
                <p className="text-sm text-yellow-800">{aiError}</p>
                <button type="button" onClick={() => createdRequestId && fetchAiOptions(createdRequestId)}
                  className="text-xs font-semibold text-yellow-700 underline shrink-0">Retry</button>
              </div>
            )}

            {aiOptions && !aiLoading && SERVICE_MAPPING
              .filter(s => services.includes(s.type) && (aiOptions[s.key]?.length ?? 0) > 0)
              .map(({ key, type, Icon, label }) => (
                <div key={type} className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Icon className="w-5 h-5" /> {label}
                  </h3>
                  {aiOptions[key].map((opt, i) => {
                    const optKey = `${type}-${i}`
                    const selected = selectedOptionKeys.has(optKey)
                    return (
                      <button
                        key={optKey} type="button" onClick={() => toggleOptionKey(optKey)}
                        className={`w-full text-left rounded-xl border-2 px-4 py-3 flex items-start justify-between gap-3 transition-all ${
                          selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                            selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                          }`}>
                            {selected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{opt.vendor}</p>
                            <p className="text-xs text-gray-500 mt-0.5 break-words">{opt.description}</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-indigo-700 shrink-0">${Number(opt.priceUsd).toLocaleString('en-US')}</p>
                      </button>
                    )
                  })}
                </div>
              ))}

            <div className="flex gap-3 pt-2 justify-between">
              <button type="button" onClick={() => router.push(`/agent/requests/${createdRequestId}`)}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Skip options
              </button>
              <button type="button" onClick={confirmOptions} disabled={aiLoading || confirmingOptions}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold transition-colors">
                {confirmingOptions ? 'Saving…' : selectedOptionKeys.size > 0
                  ? `Confirm ${selectedOptionKeys.size} option${selectedOptionKeys.size > 1 ? 's' : ''} →`
                  : 'Continue without options →'}
              </button>
            </div>
          </div>
        )}

        {step < 5 && (
        <div className={`flex gap-3 pt-2 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
          {step > 1 && (
            <button type="button" onClick={back} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              ← Back
            </button>
          )}
          {step < 4 ? (
            <button type="button" onClick={next} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors ml-auto">
              Next →
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={loading} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-8 py-2.5 text-sm font-semibold transition-colors ml-auto">
              {loading ? 'Submitting…' : 'Submit request'}
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
