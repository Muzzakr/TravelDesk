'use client'

import { PaperAirplaneIcon, BuildingOfficeIcon, TruckIcon, MapPinIcon, UserGroupIcon, CreditCardIcon, PlusCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { Paperclip } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

type BookingOption = {
  id: string
  serviceType: string
  vendor: string
  description: string
  priceUsd: number
  isSelected: boolean
}

type BookingConfirmation = {
  id: string
  serviceType: string
  confirmationNumber: string | null
  notes: string | null
  fileName: string | null
}

const serviceLabel: Record<string, string> = {
  FLIGHT: 'Flight',
  HOTEL: 'Hotel',
  CAR_RENTAL: 'Car rental',
  TAXI: 'Taxi',
  AGENT_CHOOSES: 'Agent chooses',
}

const serviceIcon: Record<string, HeroIcon> = {
  FLIGHT: PaperAirplaneIcon,
  HOTEL: BuildingOfficeIcon,
  CAR_RENTAL: TruckIcon,
  TAXI: MapPinIcon,
  AGENT_CHOOSES: UserGroupIcon,
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

export default function ApproveTravelPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [request, setRequest] = useState<Record<string, unknown> | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState<'approve' | 'reject' | 'escalate' | null>(null)
  const [escalationNote, setEscalationNote] = useState('')
  const [approvedServices, setApprovedServices] = useState<string[]>([])
  const [rejectedServices, setRejectedServices] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const r = await fetch(`/api/travel-requests/${id}`)
      if (r.ok) {
        const d = await r.json()
        setRequest(d)
        // Pre-select all services as approved
        const services = (d.servicesRequested as string[]) ?? []
        setApprovedServices(services)
      }
    }
    load()
  }, [id])

  function toggleService(svc: string, list: 'approved' | 'rejected') {
    if (list === 'approved') {
      setApprovedServices(p => p.includes(svc) ? p.filter(s => s !== svc) : [...p, svc])
      setRejectedServices(p => p.filter(s => s !== svc))
    } else {
      setRejectedServices(p => p.includes(svc) ? p.filter(s => s !== svc) : [...p, svc])
      setApprovedServices(p => p.filter(s => s !== svc))
    }
  }

  async function handle(status: 'APPROVED' | 'REJECTED') {
    if (status === 'REJECTED' && !note.trim()) {
      setError('A note is required when rejecting.')
      return
    }
    setLoading(true); setError('')
    const services = (request?.servicesRequested as string[]) ?? []
    const allApproved = approvedServices.length === services.length && rejectedServices.length === 0
    const body: Record<string, unknown> = { status, rejectionNote: status === 'REJECTED' ? note : undefined }
    if (status === 'APPROVED' && !allApproved) {
      body.approvedServices = approvedServices
      body.rejectedServices = rejectedServices
    }
    const res = await fetch(`/api/travel-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      router.push('/manager')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed')
      setLoading(false)
    }
  }

  async function handleEscalate() {
    if (!escalationNote.trim()) { setError('Please explain why you need admin approval.'); return }
    setLoading(true); setError('')
    const res = await fetch(`/api/travel-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING_ADMIN', adminEscalationNote: escalationNote }),
    })
    if (res.ok) router.push('/manager')
    else { const d = await res.json(); setError(d.error ?? 'Failed'); setLoading(false) }
  }

  if (!request) return <div className="p-8 text-gray-400">Loading…</div>

  type ApprovalAction = { actionType: string; note?: string; createdAt: string; actor: { name: string } }

  const emp = request.employee as { name: string; email: string }
  const ev = request.event as { eventName: string; budgetUsd: number; approvedSpendUsd: number }
  const dates = request.travelDates as { departureDate?: string; returnDate?: string }
  const eventBudget    = Number(ev.budgetUsd)
  const eventSpent     = Number(ev.approvedSpendUsd)
  const requestCost    = Number(request.estimatedCostUsd ?? 0)
  const projectedSpent = eventSpent + requestCost
  const budgetPct      = eventBudget > 0 ? Math.min(Math.round((eventSpent / eventBudget) * 100), 100) : 0
  const projectedPct   = eventBudget > 0 ? Math.min(Math.round((projectedSpent / eventBudget) * 100), 100) : 0
  const budgetBarColor = projectedPct >= 100 ? 'bg-red-500' : projectedPct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
  const allOptions = (request.bookingOptions as BookingOption[] | undefined) ?? []
  const selectedOptions = allOptions.filter((o) => o.isSelected)
  const selectedTotal = selectedOptions.reduce((sum, o) => sum + Number(o.priceUsd), 0)
  const confirmations = (request.bookingConfirmations as BookingConfirmation[] | undefined) ?? []
  const actions = (request.approvalActions as ApprovalAction[]) ?? []
  const reqStatus = String(request.status)
  const isDecided = ['APPROVED', 'REJECTED', 'BOOKING_CONFIRMED', 'CANCELLED', 'PENDING_ADMIN'].includes(reqStatus)
  const services = (request.servicesRequested as string[]) ?? []

  // Group selected options by serviceType
  const grouped = selectedOptions.reduce<Record<string, BookingOption[]>>((acc, o) => {
    if (!acc[o.serviceType]) acc[o.serviceType] = []
    acc[o.serviceType].push(o)
    return acc
  }, {})

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
              {dates.departureDate ? new Date(dates.departureDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}
              {dates.returnDate ? ` – ${new Date(dates.returnDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}` : ''}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Services</span>
            <p className="font-medium text-gray-900">
              {(request.servicesRequested as string[]).map(s => serviceLabel[s] ?? s).join(', ')}
            </p>
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

        {/* Event budget */}
        {eventBudget > 0 && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Event budget — {ev.eventName}</span>
              <span className={projectedPct >= 100 ? 'text-red-600' : projectedPct >= 80 ? 'text-yellow-600' : 'text-gray-500'}>
                {projectedPct}% after approval
              </span>
            </div>
            <div className="relative h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              {/* eslint-disable-next-line react/forbid-component-props */}
              <div className="absolute inset-y-0 left-0 bg-gray-300 rounded-full" style={{ width: `${budgetPct}%` }} />
              {/* eslint-disable-next-line react/forbid-component-props */}
              <div className={`absolute inset-y-0 left-0 rounded-full ${budgetBarColor}`} style={{ width: `${projectedPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Spent: <span className="font-medium text-gray-800">${eventSpent.toLocaleString('en-US')}</span></span>
              {requestCost > 0 && (
                <span>+ This request: <span className="font-medium text-indigo-700">${requestCost.toLocaleString('en-US')}</span></span>
              )}
              <span>Budget: <span className="font-medium text-gray-800">${eventBudget.toLocaleString('en-US')}</span></span>
            </div>
          </div>
        )}

        {!!request.purpose && (
          <div className="text-sm">
            <span className="text-gray-500">Purpose</span>
            <p className="mt-1 text-gray-900">{String(request.purpose)}</p>
          </div>
        )}

        {!!request.specialInstructions && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase mb-2">Trip details</p>
            <div className="space-y-2">
              {String(request.specialInstructions).split('\n').filter(Boolean).map((line, i) => {
                const { Icon, label, detail } = parseServiceLine(line)
                return (
                  <div key={i} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <Icon className="w-5 h-5 shrink-0 text-gray-500 mt-0.5" />
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

      {/* Selected booking options */}
      {selectedOptions.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Selected booking options</h2>
          <div className="space-y-3">
            {Object.entries(grouped).map(([type, opts]) => {
              const SvcIcon = serviceIcon[type] ?? PlusCircleIcon
              return (
              <div key={type}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1">
                  <SvcIcon className="w-3.5 h-3.5 shrink-0" /> {serviceLabel[type] ?? type}
                </p>
                {opts.map((o) => (
                  <div key={o.id} className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{o.vendor}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{o.description}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 whitespace-nowrap">${Number(o.priceUsd).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <p className="text-sm font-semibold text-gray-700">Total selected cost</p>
            <p className="text-lg font-bold text-indigo-600">${selectedTotal.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Booking confirmations */}
      {confirmations.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-base font-semibold text-gray-800">Booking confirmations</h2>
          <div className="space-y-3">
            {confirmations.map((c) => {
              const SvcIcon = serviceIcon[c.serviceType] ?? DocumentTextIcon
              return (
              <div key={c.id} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <SvcIcon className="w-5 h-5 shrink-0 text-gray-500 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {serviceLabel[c.serviceType] ?? c.serviceType}
                  </p>
                  {c.confirmationNumber && (
                    <p className="text-sm font-medium text-gray-900 mt-0.5">Ref: {c.confirmationNumber}</p>
                  )}
                  {c.notes && (
                    <p className="text-sm text-gray-600 mt-0.5">{c.notes}</p>
                  )}
                  {c.fileName && (
                    <a
                      href={`/api/booking-confirmations/${c.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
                    >
                      <Paperclip className="w-3.5 h-3.5" /> {c.fileName}
                    </a>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Approval history */}
      {actions.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-base font-semibold text-gray-800">History</h2>
          {actions.map((a, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className={`mt-0.5 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                a.actionType === 'APPROVE' ? 'bg-green-100 text-green-700' :
                a.actionType === 'REJECT' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>{a.actionType}</span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900">{a.actor.name}</span>
                {a.note && <p className="text-gray-500 mt-0.5 text-xs">{a.note}</p>}
              </div>
              <span className="text-xs text-gray-400 shrink-0">{new Date(a.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
        {reqStatus === 'PENDING_ADMIN' && (
          <p className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
            This request has been escalated to an Admin for a second opinion. Awaiting admin response.
          </p>
        )}

        {!isDecided && (
          <>
            {/* Per-service approve/reject (only shown in approve panel with multiple services) */}
            {panel === 'approve' && services.length > 1 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Select services to approve</p>
                {services.map(svc => {
                  const isApproved = approvedServices.includes(svc)
                  const isRejected = rejectedServices.includes(svc)
                  const SvcIcon = serviceIcon[svc] ?? PlusCircleIcon
                  return (
                    <div key={svc} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                      <SvcIcon className="w-4 h-4 shrink-0 text-gray-400" />
                      <p className="flex-1 text-sm font-medium text-gray-900">{serviceLabel[svc] ?? svc}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleService(svc, 'approved')}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${isApproved ? 'bg-green-500 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700'}`}
                        >
                          ✓ Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleService(svc, 'rejected')}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${isRejected ? 'bg-red-500 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-700'}`}
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Note textarea */}
            {(panel === 'approve' || panel === 'reject') && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  {panel === 'reject' ? 'Rejection reason (required)' : 'Note to employee (optional)'}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none w-full"
                  placeholder={panel === 'reject' ? 'Explain why this request is being rejected…' : 'Add a note for the employee (optional)…'}
                />
              </div>
            )}

            {/* Escalation note */}
            {panel === 'escalate' && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ask Admin for second opinion</p>
                <p className="text-xs text-gray-400 mb-1">This will notify all system admins and put the request on hold until they respond.</p>
                <textarea
                  value={escalationNote}
                  onChange={(e) => setEscalationNote(e.target.value)}
                  rows={3}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none w-full"
                  placeholder="Why do you need admin approval for this request?…"
                />
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

            {/* Primary action buttons */}
            {panel === null && (
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => { setPanel('approve'); setError('') }}>Approve</Button>
                <Button variant="danger" onClick={() => { setPanel('reject'); setError('') }}>Reject</Button>
                <Button variant="secondary" onClick={() => { setPanel('escalate'); setError('') }}>Ask Admin</Button>
              </div>
            )}

            {/* Confirm / cancel sub-panel buttons */}
            {panel !== null && (
              <div className="flex gap-3">
                {panel === 'approve' && (
                  <Button onClick={() => handle('APPROVED')} loading={loading}>
                    {approvedServices.length < services.length && rejectedServices.length > 0 ? 'Partially Approve' : 'Confirm Approval'}
                  </Button>
                )}
                {panel === 'reject' && (
                  <Button variant="danger" onClick={() => handle('REJECTED')} loading={loading}>Confirm Rejection</Button>
                )}
                {panel === 'escalate' && (
                  <Button onClick={handleEscalate} loading={loading}>Send to Admin</Button>
                )}
                <Button variant="secondary" onClick={() => { setPanel(null); setError('') }}>Cancel</Button>
              </div>
            )}
          </>
        )}

        {isDecided && (
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => router.back()}>Back</Button>
          </div>
        )}
      </div>
    </div>
  )
}
