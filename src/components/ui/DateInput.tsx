'use client'

import { useRef, useState, useEffect } from 'react'

interface DateInputProps {
  value: string                      // YYYY-MM-DD or ""
  onChange: (value: string) => void  // emits YYYY-MM-DD or ""
  label?: string
  className?: string
  title?: string
  required?: boolean
}

function isoToDisplay(iso: string): string {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

function displayToIso(display: string): string {
  const parts = display.split('/')
  if (parts.length !== 3 || parts[2].length !== 4) return ''
  const [m, d, y] = parts
  const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
  if (isNaN(date.getTime())) return ''
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

const baseCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 w-full'

export function DateInput({ value, onChange, label, className, title, required }: DateInputProps) {
  const [display, setDisplay] = useState(isoToDisplay(value))
  const pickerRef = useRef<HTMLInputElement>(null)
  const inputId = (title ?? label ?? 'date').toLowerCase().replace(/\s+/g, '-')

  useEffect(() => { setDisplay(isoToDisplay(value)) }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    let fmt = digits
    if (digits.length > 2) fmt = `${digits.slice(0, 2)}/${digits.slice(2)}`
    if (digits.length > 4) fmt = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
    setDisplay(fmt)
    onChange(displayToIso(fmt))
  }

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
    setDisplay(isoToDisplay(e.target.value))
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}{required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          placeholder="MM/DD/YYYY"
          maxLength={10}
          title={title ?? label ?? 'Date'}
          className={className ? `${className} pr-8` : `${baseCls} pr-8`}
        />
        <button
          type="button"
          title="Open calendar"
          onClick={() => pickerRef.current?.showPicker?.()}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={value}
          onChange={handlePickerChange}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
      </div>
    </div>
  )
}
