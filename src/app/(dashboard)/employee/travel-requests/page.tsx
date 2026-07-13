'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { LoadError } from '@/components/ui/LoadError'

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
  const router = useRouter()
  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  async function load() {
    setLoadError(false)
    try {
      const [reqRes, sessionRes] = await Promise.all([
        fetch('/api/travel-requests'),
        fetch('/api/auth/session'),
      ])
      if (!reqRes.ok) throw new Error(`HTTP ${reqRes.status}`)
      const data = await reqRes.json()
      const session = await sessionRes.json().catch(() => null)
      setRequests(Array.isArray(data) ? data : [])
      setRole(session?.user?.role ?? null)
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Travel requests</h1>
        {['EMPLOYEE', 'SYSTEM_ADMIN'].includes(role ?? '') && (
          <Link href="/employee/travel-requests/new" className="shrink-0 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            + New
          </Link>
        )}
      </div>

      {loadError ? (
        <LoadError onRetry={load} />
      ) : requests.length === 0 ? (
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
              return (
                <Link key={r.id} href={`/employee/travel-requests/${r.id}`}
                  className={`block rounded-xl border bg-white px-4 py-3 space-y-2 active:bg-gray-50 ${needsAction ? 'border-orange-300' : ''}`}>
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
                    <p className={`text-xs italic ${needsAction ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>{STATUS_DESCRIPTIONS[r.status]}</p>
                  )}
                </Link>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r) => {
                  const dates = r.travelDates as { departureDate: string; returnDate: string }
                  const needsAction = r.status === 'OPTIONS_PROVIDED' && role === 'EMPLOYEE'
                  return (
                    <tr key={r.id} onClick={() => router.push(`/employee/travel-requests/${r.id}`)}
                      className={`cursor-pointer hover:bg-gray-50 ${needsAction ? 'bg-orange-50/50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {r.origin} → {r.destination}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.event.eventName}</td>
                      <td className="px-4 py-3 text-gray-500">{dates.departureDate}</td>
                      <td className="px-4 py-3">{r.estimatedCostUsd ? `$${Number(r.estimatedCostUsd).toFixed(0)}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span title={STATUS_DESCRIPTIONS[r.status]}>
                          <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Mobile floating new-request button — always reachable on small screens */}
      {['EMPLOYEE', 'SYSTEM_ADMIN'].includes(role ?? '') && (
        <Link
          href="/employee/travel-requests/new"
          aria-label="New travel request"
          className="md:hidden fixed right-5 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700"
        >
          <Plus className="w-6 h-6" />
        </Link>
      )}
    </div>
  )
}
