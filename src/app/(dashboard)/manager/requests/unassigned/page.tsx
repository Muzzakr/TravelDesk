'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { Plane, Hotel, Car, Bus, PlusCircle, Users } from 'lucide-react'

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FLIGHT: Plane, HOTEL: Hotel, CAR_RENTAL: Car, TRAIN: Bus,
}
const SERVICE_LABEL: Record<string, string> = {
  FLIGHT: 'Flight', HOTEL: 'Hotel', CAR_RENTAL: 'Car Rental', TRAIN: 'Train', OTHER: 'Other',
}

type Request = {
  id: string
  origin: string
  destination: string
  status: string
  estimatedCostUsd: string | number | null
  servicesRequested: string[]
  createdAt: string
  travelDates: { departureDate?: string; returnDate?: string } | null
  employee: { name: string; email: string }
  event: { eventName: string } | null
}

export default function UnassignedRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const r = await fetch('/api/manager/unassigned-requests')
    if (r.ok) setRequests(await r.json())
    setLoading(false)
  }

  async function claim(id: string) {
    setClaiming(id); setError('')
    const res = await fetch(`/api/travel-requests/${id}/claim`, { method: 'POST' })
    if (res.ok) {
      router.push(`/manager/approvals/travel/${id}`)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to claim request')
      setClaiming(null)
    }
  }

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Open Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">Unassigned travel requests — claim one to become the approving manager</p>
      </div>

      {error && <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading && <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>}

      {!loading && requests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <Users className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No unassigned requests</p>
          <p className="text-xs text-gray-400 mt-1">All pending requests have been claimed by a manager</p>
        </div>
      )}

      {!loading && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map(req => {
            const dates = req.travelDates
            return (
              <div key={req.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{req.employee.name}</span>
                    <span className="text-xs text-gray-400">{req.employee.email}</span>
                    <Badge variant={statusToBadgeVariant(req.status)}>{req.status.replace(/_/g, ' ')}</Badge>
                  </div>

                  <div className="flex items-center gap-1 text-sm text-gray-700">
                    <span className="font-medium">{req.origin}</span>
                    <span className="text-gray-400 mx-1">→</span>
                    <span className="font-medium">{req.destination}</span>
                    {req.event && (
                      <span className="ml-2 text-xs text-gray-400">· {req.event.eventName}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>{fmt(dates?.departureDate)}{dates?.returnDate ? ` – ${fmt(dates.returnDate)}` : ''}</span>
                    <span className="text-gray-300">·</span>
                    <span className="font-semibold text-gray-700">
                      {req.estimatedCostUsd ? `$${Number(req.estimatedCostUsd).toFixed(2)}` : '—'}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="flex items-center gap-1">
                      {req.servicesRequested.map(s => {
                        const Icon = SERVICE_ICONS[s] ?? PlusCircle
                        return <Icon key={s} className="w-3.5 h-3.5 text-gray-400" />
                      })}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span>Submitted {fmt(req.createdAt)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => claim(req.id)}
                  disabled={claiming === req.id}
                  className="shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
                >
                  {claiming === req.id ? 'Claiming…' : 'Claim & Review'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
