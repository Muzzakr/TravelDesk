'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

export default function ApproveTravelPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [request, setRequest] = useState<Record<string, unknown> | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/travel-requests/${id}`).then((r) => r.json()).then(setRequest)
  }, [id])

  async function handle(status: 'APPROVED' | 'REJECTED') {
    if (status === 'REJECTED' && !note.trim()) {
      setError('A note is required when rejecting.')
      return
    }
    setLoading(true)
    const res = await fetch(`/api/travel-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectionNote: status === 'REJECTED' ? note : undefined }),
    })
    if (res.ok) {
      router.push('/manager')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed')
      setLoading(false)
    }
  }

  if (!request) return <div className="p-8 text-gray-400">Loading…</div>

  const emp = request.employee as { name: string; email: string }
  const ev = request.event as { eventName: string }
  const dates = request.travelDates as { departureDate?: string; returnDate?: string }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Review travel request</h1>

      <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Employee</span>
            <p className="font-medium text-gray-900">{emp.name}</p>
            <p className="text-xs text-gray-400">{emp.email}</p>
          </div>
          <div>
            <span className="text-gray-500">Event</span>
            <p className="font-medium text-gray-900">{ev.eventName}</p>
          </div>
          <div>
            <span className="text-gray-500">Route</span>
            <p className="font-medium text-gray-900">{String(request.origin)} → {String(request.destination)}</p>
          </div>
          <div>
            <span className="text-gray-500">Travel dates</span>
            <p className="font-medium text-gray-900">
              {dates.departureDate ? new Date(dates.departureDate).toLocaleDateString() : '—'}
              {dates.returnDate ? ` – ${new Date(dates.returnDate).toLocaleDateString()}` : ''}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Services</span>
            <p className="font-medium text-gray-900">{(request.servicesRequested as string[]).join(', ')}</p>
          </div>
          <div>
            <span className="text-gray-500">Est. cost</span>
            <p className="text-xl font-bold text-gray-900">
              {request.estimatedCostUsd ? `$${Number(request.estimatedCostUsd).toFixed(2)}` : '—'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Class</span>
            <p className="font-medium text-gray-900">{String(request.preferredClass)}</p>
          </div>
          <div>
            <span className="text-gray-500">Status</span>
            <Badge variant={statusToBadgeVariant(String(request.status))}>{String(request.status).replace(/_/g, ' ')}</Badge>
          </div>
        </div>

        {!!request.purpose && (
          <div className="text-sm">
            <span className="text-gray-500">Purpose</span>
            <p className="mt-1 text-gray-900">{String(request.purpose)}</p>
          </div>
        )}

        {!!request.specialInstructions && (
          <div className="text-sm">
            <span className="text-gray-500">Special instructions</span>
            <p className="mt-1 text-gray-900">{String(request.specialInstructions)}</p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Note (required for rejection)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Add a note…"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={() => handle('APPROVED')} loading={loading}>Approve</Button>
          <Button variant="danger" onClick={() => handle('REJECTED')} loading={loading}>Reject</Button>
          <Button variant="secondary" onClick={() => router.back()}>Back</Button>
        </div>
      </div>
    </div>
  )
}
