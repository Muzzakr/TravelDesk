'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Employee {
  id: string
  name: string
  email: string
  role: string
}

interface Event {
  id: string
  eventName: string
  eventCode: string
  status: string
}

export default function AgentBookPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    employeeId: '',
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
    fetch('/api/agent/employees').then((r) => r.json()).then(setEmployees)
    fetch('/api/events').then((r) => r.json()).then(setEvents)
  }, [])

  function toggleService(service: string) {
    setForm((f) => ({
      ...f,
      servicesRequested: f.servicesRequested.includes(service)
        ? f.servicesRequested.filter((s) => s !== service)
        : [...f.servicesRequested, service],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    if (form.servicesRequested.length === 0) {
      setError('Select at least one service.')
      setSubmitting(false)
      return
    }

    const payload = {
      employeeId: form.employeeId,
      eventId: form.eventId,
      origin: form.origin,
      destination: form.destination,
      travelDates: { departureDate: form.departureDate, returnDate: form.returnDate },
      servicesRequested: form.servicesRequested,
      estimatedCostUsd: form.estimatedCostUsd ? parseFloat(form.estimatedCostUsd) : undefined,
      purpose: form.purpose,
      preferredClass: form.preferredClass,
      hotelNights: form.hotelNights ? parseInt(form.hotelNights) : undefined,
      carRentalDays: form.carRentalDays ? parseInt(form.carRentalDays) : undefined,
      specialInstructions: form.specialInstructions || undefined,
    }

    const res = await fetch('/api/agent/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const data = await res.json()
      router.push(`/agent/requests/${data.id}`)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to create request')
    }
    setSubmitting(false)
  }

  const activeEvents = events.filter((e) => e.status === 'ACTIVE')

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Book on behalf of employee</h1>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-white p-6">
        {/* Employee */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
          <select
            required
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select employee...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} — {emp.email}
              </option>
            ))}
          </select>
        </div>

        {/* Event */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event *</label>
          <select
            required
            value={form.eventId}
            onChange={(e) => setForm({ ...form, eventId: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select event...</option>
            {activeEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.eventName} ({ev.eventCode})
              </option>
            ))}
          </select>
        </div>

        {/* Route */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin *</label>
            <input
              required
              type="text"
              placeholder="e.g. Stockholm"
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
            <input
              required
              type="text"
              placeholder="e.g. Copenhagen"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Departure date *</label>
            <input
              required
              type="date"
              value={form.departureDate}
              onChange={(e) => setForm({ ...form, departureDate: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Return date *</label>
            <input
              required
              type="date"
              value={form.returnDate}
              onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Services */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Services needed *</label>
          <div className="flex gap-3 flex-wrap">
            {['FLIGHT', 'HOTEL', 'CAR_RENTAL'].map((svc) => (
              <label key={svc} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.servicesRequested.includes(svc)}
                  onChange={() => toggleService(svc)}
                  className="rounded border-gray-300 text-indigo-600"
                />
                {svc.replace('_', ' ')}
              </label>
            ))}
          </div>
        </div>

        {/* Class + Cost */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred class</label>
            <select
              value={form.preferredClass}
              onChange={(e) => setForm({ ...form, preferredClass: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ECONOMY">Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated cost (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.estimatedCostUsd}
              onChange={(e) => setForm({ ...form, estimatedCostUsd: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Hotel / Car */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hotel nights</label>
            <input
              type="number"
              min="1"
              placeholder="—"
              value={form.hotelNights}
              onChange={(e) => setForm({ ...form, hotelNights: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Car rental days</label>
            <input
              type="number"
              min="1"
              placeholder="—"
              value={form.carRentalDays}
              onChange={(e) => setForm({ ...form, carRentalDays: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
          <input
            required
            type="text"
            placeholder="e.g. Client meeting, Conference attendance"
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Special instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Special instructions</label>
          <textarea
            rows={3}
            placeholder="Seat preferences, dietary requirements, etc."
            value={form.specialInstructions}
            onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create request'}
          </button>
        </div>
      </form>
    </div>
  )
}
