'use client'

import { PaperAirplaneIcon, BuildingOfficeIcon, TruckIcon, MapPinIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'
import { useEffect, useRef, useState } from 'react'

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>

const SERVICE_ICON: Record<string, HeroIcon> = {
  FLIGHT: PaperAirplaneIcon,
  HOTEL: BuildingOfficeIcon,
  CAR_RENTAL: TruckIcon,
  TAXI: MapPinIcon,
}

const SERVICE_LABEL: Record<string, string> = {
  FLIGHT: 'Flight',
  HOTEL: 'Hotel',
  CAR_RENTAL: 'Car Rental',
  TAXI: 'Taxi / Transfer',
  AGENT_CHOOSES: 'Agent Chooses',
}

const ALL_SERVICES = ['FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TAXI']

type ServiceEntry = {
  confirmationNumber: string
  notes: string
  files: File[]
}

function emptyEntry(): ServiceEntry {
  return { confirmationNumber: '', notes: '', files: [] }
}

/**
 * The booking-confirmation form the agent uses to send booking details
 * (reference number, documents, notes) to the employee. Shared by the
 * agent request page, the manager review page (Travel Manager) and the
 * admin request page so all three roles get identical behavior.
 */
export function BookingConfirmationForm({
  requestId,
  servicesRequested,
  onSuccess,
}: {
  requestId: string
  servicesRequested: string[]
  onSuccess: () => void
}) {
  const [serviceEntries, setServiceEntries] = useState<Record<string, ServiceEntry>>({})
  // For AGENT_CHOOSES: the sender picks which services they're confirming
  const [agentPickedServices, setAgentPickedServices] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const isAgentChooses = servicesRequested.includes('AGENT_CHOOSES')

  useEffect(() => {
    const initial: Record<string, ServiceEntry> = {}
    const svcs = servicesRequested.includes('AGENT_CHOOSES') ? [] : servicesRequested
    svcs.forEach((s) => { initial[s] = emptyEntry() })
    if (servicesRequested.includes('AGENT_CHOOSES')) {
      setAgentPickedServices(['AGENT_CHOOSES'])
      setServiceEntries({ AGENT_CHOOSES: emptyEntry() })
    } else {
      setServiceEntries(initial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, servicesRequested.join(',')])

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
    const res = await fetch(`/api/travel-requests/${requestId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ services }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : 'Failed to confirm booking')
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

    setSubmitting(false)
    onSuccess()
  }

  const confirmSections = isAgentChooses ? agentPickedServices : servicesRequested

  return (
    <form onSubmit={handleConfirm} className="rounded-xl border-2 border-green-100 bg-green-50 p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-green-900">Complete booking</h2>
        <p className="text-xs text-green-700 mt-0.5">
          Fill in the confirmation details for each service. The employee will be notified.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* For AGENT_CHOOSES: let the sender pick which services they're confirming */}
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
  )
}
