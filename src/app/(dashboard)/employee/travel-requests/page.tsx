'use client'

import { useState, useEffect } from 'react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'
import { Zap } from 'lucide-react'

interface TravelRequest {
  id: string
  origin: string
  destination: string
  status: string
  travelDates: { departureDate: string; returnDate: string }
  estimatedCostUsd: number | null
  event: { eventName: string; eventCode: string }
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  DRAFT: 'Saved, not yet submitted',
  SUBMITTED: 'Awaiting assignment to travel agent',
  PENDING_AGENT: 'Travel agent is preparing options',
  OPTIONS_PROVIDED: 'Your travel agent has provided options — choose one',
  PENDING_MANAGER: 'Waiting for manager approval',
  APPROVED: 'Approved',
  BOOKING_CONFIRMED: 'Booking confirmed by travel agent',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

export default function TravelRequestsPage() {
  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/travel-requests').then((r) => r.json()),
      fetch('/api/auth/session').then((r) => r.json()),
    ]).then(([data, session]) => {
      setRequests(data)
      setRole(session?.user?.role ?? null)
    })
  }, [])

  async function cancelRequest(id: string) {
    if (!confirm('Cancel this travel request?')) return
    setCancellingId(id)
    await fetch(`/api/travel-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    })
    const refreshed = await fetch('/api/travel-requests').then((r) => r.json())
    setRequests(refreshed)
    setCancellingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Travel requests</h1>
        {['EMPLOYEE', 'SYSTEM_ADMIN'].includes(role ?? '') && (
          <Link href="/employee/travel-requests/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            + New
          </Link>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-gray-400">
          <p>No travel requests yet.</p>
          {role === 'EMPLOYEE' && (
            <Link href="/employee/travel-requests/new" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
              Create your first request →
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {requests.map((r) => {
              const dates = r.travelDates as { departureDate: string; returnDate: string }
              const needsAction = r.status === 'OPTIONS_PROVIDED' && role === 'EMPLOYEE'
              const isDraft = r.status === 'DRAFT'
              return (
                <div key={r.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{r.origin} → {r.destination}</p>
                      <p className="text-xs text-gray-400">{r.event.eventName}</p>
                      <p className="text-xs text-gray-400">{dates.departureDate}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                      {r.estimatedCostUsd && <p className="mt-1 text-xs font-semibold text-gray-700">${Number(r.estimatedCostUsd).toFixed(0)}</p>}
                    </div>
                  </div>
                  {STATUS_DESCRIPTIONS[r.status] && (
                    <p className="text-xs text-gray-500 italic">{STATUS_DESCRIPTIONS[r.status]}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/employee/travel-requests/${r.id}`}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors ${needsAction ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                      {needsAction ? <><Zap className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />Choose option</> : 'View →'}
                    </Link>
                    {isDraft && role === 'EMPLOYEE' && (
                      <button
                        type="button"
                        onClick={() => cancelRequest(r.id)}
                        disabled={cancellingId === r.id}
                        className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                      >
                        {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">Departure</th>
                  <th className="px-4 py-3 text-left">Est. cost</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r) => {
                  const dates = r.travelDates as { departureDate: string; returnDate: string }
                  const needsAction = r.status === 'OPTIONS_PROVIDED' && role === 'EMPLOYEE'
                  const isDraft = r.status === 'DRAFT'
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link href={`/employee/travel-requests/${r.id}`} className="hover:text-indigo-600">
                          {r.origin} → {r.destination}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.event.eventName}</td>
                      <td className="px-4 py-3 text-gray-500">{dates.departureDate}</td>
                      <td className="px-4 py-3">{r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(0)}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span title={STATUS_DESCRIPTIONS[r.status]}>
                          <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                        </span>
                      </td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        <Link
                          href={`/employee/travel-requests/${r.id}`}
                          className={`text-xs font-medium hover:underline ${needsAction ? 'text-orange-600 font-semibold' : 'text-indigo-600'}`}
                        >
                          {needsAction ? <><Zap className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />Choose option</> : 'View →'}
                        </Link>
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => cancelRequest(r.id)}
                            disabled={cancellingId === r.id}
                            className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                          >
                            {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
