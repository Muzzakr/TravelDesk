'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { TravelEvent } from '@/types/event'

const SERVICES = ['FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TAXI']

function fmtDate(val: string): string {
  const d = val.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 8)}`
}

function toISO(s: string): string {
  const [dd, mm, yyyy] = s.split('/')
  if (!dd || !mm || !yyyy) return ''
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

export default function NewTravelRequestPage() {
  const router = useRouter()
  const [events, setEvents] = useState<TravelEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [form, setForm] = useState({
    eventId: '',
    origin: '',
    destination: '',
    departureDate: '',
    returnDate: '',
    servicesRequested: [] as string[],
    estimatedCostUsd: '',
    purpose: '',
    preferredClass: 'ECONOMY',
    hotelNights: '',
    carRentalDays: '',
    specialInstructions: '',
  })

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((data) => setEvents(data.filter((e: TravelEvent) => e.status !== 'CLOSED')))
  }, [])

  function toggleService(service: string) {
    setForm((prev) => ({
      ...prev,
      servicesRequested: prev.servicesRequested.includes(service)
        ? prev.servicesRequested.filter((s) => s !== service)
        : [...prev.servicesRequested, service],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.eventId) { setError('Please select an event'); return }
    if (form.servicesRequested.length === 0) { setError('Select at least one service'); return }

    setLoading(true)
    setError('')
    setWarning('')

    const res = await fetch('/api/travel-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        travelDates: { departureDate: toISO(form.departureDate), returnDate: toISO(form.returnDate) },
        estimatedCostUsd: form.estimatedCostUsd ? Number(form.estimatedCostUsd) : undefined,
        hotelNights: form.hotelNights ? Number(form.hotelNights) : undefined,
        carRentalDays: form.carRentalDays ? Number(form.carRentalDays) : undefined,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Failed to submit')
      setLoading(false)
      return
    }
    if (data.budgetWarning) {
      setWarning('Warning: this request brings the event close to its budget cap.')
    }
    router.push('/employee/travel-requests')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New travel request</h1>
      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-8 shadow-sm">
        {/* Event picker — required */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Event <span className="text-red-500">*</span>
          </label>
          <select
            value={form.eventId}
            onChange={(e) => setForm((p) => ({ ...p, eventId: e.target.value }))}
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">Select an event…</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.eventName} ({ev.eventCode})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Origin" name="origin" value={form.origin} onChange={(e) => setForm((p) => ({ ...p, origin: e.target.value }))} required placeholder="Stockholm" />
          <Input label="Destination" name="destination" value={form.destination} onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))} required placeholder="London" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Departure date" type="text" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10} value={form.departureDate} onChange={(e) => setForm((p) => ({ ...p, departureDate: fmtDate(e.target.value) }))} required />
          <Input label="Return date" type="text" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10} value={form.returnDate} onChange={(e) => setForm((p) => ({ ...p, returnDate: fmtDate(e.target.value) }))} required />
        </div>

        {/* Services */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Services needed <span className="text-red-500">*</span></label>
          <div className="flex gap-3">
            {SERVICES.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.servicesRequested.includes(s)}
                  onChange={() => toggleService(s)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                <span className="text-sm text-gray-700">{s.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <Input
          label="Purpose"
          value={form.purpose}
          onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
          required
          placeholder="Client visit — Q3 review"
        />

        <Input label="Estimated cost (USD)" type="number" value={form.estimatedCostUsd} onChange={(e) => setForm((p) => ({ ...p, estimatedCostUsd: e.target.value }))} placeholder="1200" />

        <Input label="Special instructions" value={form.specialInstructions} onChange={(e) => setForm((p) => ({ ...p, specialInstructions: e.target.value }))} placeholder="Aisle seat preferred, vegetarian meal" />

        {warning && <p className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">{warning}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={loading}>Submit request</Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
