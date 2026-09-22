'use client'

import { useState } from 'react'

export interface BookingOption {
  id: string
  serviceType: string
  vendor: string
  description: string
  priceUsd: number | string
  bookingLink?: string | null
  isSelected: boolean
}

interface BookingOptionPickerProps {
  requestId: string
  bookingOptions: BookingOption[]
  heading: string
  description: string
  /** Called after a successful selection so the caller can reload the request. */
  onConfirmed: () => void | Promise<void>
}

/**
 * One radio group per service type, live selection summary, and a confirm
 * button that POSTs to /api/travel-requests/[id]/select-option. Shared by
 * the employee's own picker and the admin's on-behalf-of override — the
 * API allows SYSTEM_ADMIN to call this endpoint for any request in the
 * company, employees only for their own.
 */
export function BookingOptionPicker({ requestId, bookingOptions, heading, description, onConfirmed }: BookingOptionPickerProps) {
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  const optionsByService = bookingOptions.reduce<Record<string, BookingOption[]>>((acc, opt) => {
    if (!acc[opt.serviceType]) acc[opt.serviceType] = []
    acc[opt.serviceType].push(opt)
    return acc
  }, {})

  async function confirmSelections() {
    setConfirming(true)
    setError('')
    const res = await fetch(`/api/travel-requests/${requestId}/select-option`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionIds: Object.values(picks) }),
    })
    if (res.ok) {
      await onConfirmed()
      setPicks({})
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to confirm selections')
    }
    setConfirming(false)
  }

  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-indigo-900">{heading}</h2>
        <p className="text-xs text-indigo-700 mt-0.5">{description}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {Object.entries(optionsByService).map(([serviceType, opts]) => (
        <div key={serviceType} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {serviceType.replace('_', ' ')}
          </p>
          {opts.map((opt) => {
            const isChosen = picks[serviceType] === opt.id
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-3 rounded-lg border bg-white p-4 cursor-pointer transition-colors
                  ${isChosen ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <input
                  type="radio"
                  name={serviceType}
                  value={opt.id}
                  checked={isChosen}
                  onChange={() => setPicks((prev) => ({ ...prev, [serviceType]: opt.id }))}
                  className="mt-1 accent-indigo-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{opt.vendor}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
                  {opt.bookingLink && (
                    <a href={opt.bookingLink} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      View booking →
                    </a>
                  )}
                </div>
                <p className="text-sm font-bold text-indigo-700 shrink-0">${Number(opt.priceUsd).toFixed(2)}</p>
              </label>
            )
          })}
        </div>
      ))}

      {/* Summary */}
      {Object.keys(picks).length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Selection summary</p>
          {Object.entries(picks).map(([serviceType, optId]) => {
            const opt = bookingOptions.find((o) => o.id === optId)
            if (!opt) return null
            return (
              <div key={serviceType} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-xs font-medium uppercase text-gray-400 mr-2">{serviceType.replace('_', ' ')}</span>
                  <span className="font-medium text-gray-900">{opt.vendor}</span>
                  <span className="text-gray-500 ml-2">— {opt.description}</span>
                </div>
                <span className="font-bold text-indigo-700 shrink-0 ml-4">${Number(opt.priceUsd).toFixed(2)}</span>
              </div>
            )
          })}
          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-sm font-semibold text-gray-700">
              Total: <span className="text-indigo-700">
                ${Object.values(picks).reduce((sum, optId) => {
                  const opt = bookingOptions.find((o) => o.id === optId)
                  return sum + (opt ? Number(opt.priceUsd) : 0)
                }, 0).toFixed(2)}
              </span>
            </p>
            <button
              type="button"
              onClick={confirmSelections}
              disabled={confirming || Object.keys(picks).length < Object.keys(optionsByService).length}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {confirming ? 'Confirming…' : 'Confirm selections →'}
            </button>
          </div>
          {Object.keys(picks).length < Object.keys(optionsByService).length && (
            <p className="text-xs text-amber-600">Select one option from each category to continue.</p>
          )}
        </div>
      )}
    </div>
  )
}
