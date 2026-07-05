'use client'

import React, { useState, useEffect } from 'react'
import { compressImageFile } from '@/lib/compress'
import { FileUpload } from '@/components/ui/FileUpload'
import { DateInput } from '@/components/ui/DateInput'
import { advanceOnEnter } from '@/lib/form-nav'
import type { TravelEvent } from '@/types/event'
import { Check } from 'lucide-react'

// ─── Constants (moved verbatim from employee/expenses) ───────────────────────

const inputCls = 'rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white'

type ExpenseSubKey =
  | 'FLIGHT' | 'TAXI' | 'CAR_RENTAL' | 'TRAIN' | 'BUS' | 'PARKING' | 'FUEL'
  | 'HOTEL' | 'APARTMENT' | 'AIRBNB' | 'OTHER_LODGING'
  | 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACKS' | 'CLIENT_MEALS'
  | 'OTHER'

const MAIN_CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'TRANSPORT',     label: 'Transport',     emoji: '✈️' },
  { key: 'ACCOMMODATION', label: 'Accommodation', emoji: '🏨' },
  { key: 'FOOD_MEALS',    label: 'Food & Meals',  emoji: '🍽️' },
  { key: 'OTHER',         label: 'Other',         emoji: '📎' },
]

const SUB_CATEGORIES: Record<string, { key: ExpenseSubKey; label: string; emoji: string }[]> = {
  TRANSPORT: [
    { key: 'FLIGHT',     label: 'Flight',     emoji: '✈️' },
    { key: 'TAXI',       label: 'Taxi',       emoji: '🚕' },
    { key: 'CAR_RENTAL', label: 'Car Rental', emoji: '🚗' },
    { key: 'TRAIN',      label: 'Train',      emoji: '🚂' },
    { key: 'BUS',        label: 'Bus',        emoji: '🚌' },
    { key: 'PARKING',    label: 'Parking',    emoji: '🅿️' },
    { key: 'FUEL',       label: 'Fuel',       emoji: '⛽' },
  ],
  ACCOMMODATION: [
    { key: 'HOTEL',         label: 'Hotel',         emoji: '🏨' },
    { key: 'APARTMENT',     label: 'Apartment',     emoji: '🏢' },
    { key: 'AIRBNB',        label: 'Airbnb',        emoji: '🏠' },
    { key: 'OTHER_LODGING', label: 'Other Lodging', emoji: '🛏️' },
  ],
  FOOD_MEALS: [
    { key: 'BREAKFAST',    label: 'Breakfast',    emoji: '☕' },
    { key: 'LUNCH',        label: 'Lunch',        emoji: '🥙' },
    { key: 'DINNER',       label: 'Dinner',       emoji: '🍽️' },
    { key: 'SNACKS',       label: 'Snacks',       emoji: '🍿' },
    { key: 'CLIENT_MEALS', label: 'Client Meals', emoji: '🤝' },
  ],
}

const SUB_CATEGORY_MAP: Record<string, { category: string; service: string }> = {
  FLIGHT:        { category: 'TRANSPORT',     service: 'Flight' },
  TAXI:          { category: 'TRANSPORT',     service: 'Taxi' },
  CAR_RENTAL:    { category: 'TRANSPORT',     service: 'Car Rental' },
  TRAIN:         { category: 'TRANSPORT',     service: 'Train' },
  BUS:           { category: 'TRANSPORT',     service: 'Bus' },
  PARKING:       { category: 'TRANSPORT',     service: 'Parking' },
  FUEL:          { category: 'TRANSPORT',     service: 'Fuel' },
  HOTEL:         { category: 'ACCOMMODATION', service: 'Hotel' },
  APARTMENT:     { category: 'ACCOMMODATION', service: 'Apartment' },
  AIRBNB:        { category: 'ACCOMMODATION', service: 'Airbnb' },
  OTHER_LODGING: { category: 'ACCOMMODATION', service: 'Other Lodging' },
  BREAKFAST:     { category: 'MEALS',         service: 'Breakfast' },
  LUNCH:         { category: 'MEALS',         service: 'Lunch' },
  DINNER:        { category: 'MEALS',         service: 'Dinner' },
  SNACKS:        { category: 'MEALS',         service: 'Snacks' },
  CLIENT_MEALS:  { category: 'MEALS',         service: 'Client Meals' },
  OTHER:         { category: 'OTHER',         service: 'Other' },
}

const SERVICE_DETAIL_CONFIG: Record<string, { merchantLabel: string; merchantPlaceholder: string; descPlaceholder: string }> = {
  FLIGHT:        { merchantLabel: 'Airline',               merchantPlaceholder: 'E.g. SAS, Norwegian',      descPlaceholder: 'E.g. Return flight to Stockholm' },
  TAXI:          { merchantLabel: 'Provider (optional)',   merchantPlaceholder: 'E.g. Uber, Bolt',          descPlaceholder: 'E.g. Airport → hotel' },
  CAR_RENTAL:    { merchantLabel: 'Rental company',        merchantPlaceholder: 'E.g. Avis, Hertz',         descPlaceholder: 'E.g. 3-day rental' },
  TRAIN:         { merchantLabel: 'Operator (optional)',   merchantPlaceholder: 'E.g. SJ, Intercity',       descPlaceholder: 'E.g. Stockholm → Gothenburg' },
  BUS:           { merchantLabel: 'Operator (optional)',   merchantPlaceholder: 'E.g. FlixBus',             descPlaceholder: 'E.g. Airport bus' },
  PARKING:       { merchantLabel: 'Location (optional)',   merchantPlaceholder: 'E.g. Airport Parking',     descPlaceholder: 'E.g. 2 days parking' },
  FUEL:          { merchantLabel: 'Station (optional)',    merchantPlaceholder: 'E.g. Shell, BP',           descPlaceholder: 'E.g. Fuel for rental car' },
  HOTEL:         { merchantLabel: 'Hotel name',            merchantPlaceholder: 'E.g. Scandic Downtown',    descPlaceholder: 'E.g. 2 nights, conference rate' },
  APARTMENT:     { merchantLabel: 'Property name',         merchantPlaceholder: 'E.g. City Centre Flat',    descPlaceholder: 'E.g. 3-night stay' },
  AIRBNB:        { merchantLabel: 'Host / Property',       merchantPlaceholder: 'E.g. Studio in Milan',     descPlaceholder: 'E.g. 2-night Airbnb stay' },
  OTHER_LODGING: { merchantLabel: 'Location (optional)',   merchantPlaceholder: 'E.g. Hostel name',         descPlaceholder: 'E.g. Overnight accommodation' },
  BREAKFAST:     { merchantLabel: 'Vendor (optional)',     merchantPlaceholder: 'E.g. Hotel, Café',         descPlaceholder: 'E.g. Breakfast on travel day' },
  LUNCH:         { merchantLabel: 'Restaurant (optional)', merchantPlaceholder: 'E.g. The Local Bistro',    descPlaceholder: 'E.g. Working lunch' },
  DINNER:        { merchantLabel: 'Restaurant (optional)', merchantPlaceholder: 'E.g. Restaurant name',     descPlaceholder: 'E.g. Team dinner' },
  SNACKS:        { merchantLabel: 'Vendor (optional)',     merchantPlaceholder: 'E.g. Convenience store',   descPlaceholder: 'E.g. Snacks during travel' },
  CLIENT_MEALS:  { merchantLabel: 'Restaurant',            merchantPlaceholder: 'E.g. Restaurant name',     descPlaceholder: 'E.g. Lunch with client' },
  OTHER:         { merchantLabel: 'Vendor (optional)',     merchantPlaceholder: 'E.g. Office Depot',        descPlaceholder: 'E.g. USB-C hub for laptop' },
}

// ─── Field helper ─────────────────────────────────────────────────────────────

// Mobile keyboards in many locales (e.g. Swedish) only offer a comma on the
// decimal keypad, which type="number" inputs silently reject. We use a text
// input and normalise commas to dots instead.
export function sanitizeAmountInput(v: string): string {
  const normalized = v.replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = normalized.indexOf('.')
  return i === -1 ? normalized : normalized.slice(0, i + 1) + normalized.slice(i + 1).replace(/\./g, '')
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// currency intentionally omitted — the API defaults to USD and no selector exists yet
const EMPTY_FORM = {
  eventId: '', employeeId: '', amountUsd: '',
  description: '', merchantName: '', transactionDate: '',
  reason: '', personName: '',
}

type Props = {
  /** localStorage key for draft persistence. Omit to disable drafts. */
  draftKey?: string
  /** When set, step 1 shows an employee picker — Travel Manager/Admin creating on behalf of someone. */
  employees?: { id: string; name: string }[]
  /** "Will be approved by" banner in step 1 (employee's own flow). */
  manager?: { name: string; email: string } | null
  onCancel: () => void
  /** Called after successful save. `notice` is set if the receipt upload failed. */
  onSaved: (notice?: string) => void
}

export function NewExpenseForm({ draftKey, employees, manager, onCancel, onSaved }: Props) {
  const isOnBehalf = Array.isArray(employees)

  const [events, setEvents] = useState<TravelEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // 2-level category selection
  const [mainCategory, setMainCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [step, setStep] = useState(1)
  const [vehicleType, setVehicleType] = useState('')

  // Inline event combobox state
  const [eventSearch, setEventSearch] = useState('')
  const [eventDropOpen, setEventDropOpen] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    fetch('/api/events?view=picker').then(r => r.json()).then((data: TravelEvent[]) =>
      setEvents(data.filter((e: TravelEvent) => e.status !== 'CLOSED'))
    )
  }, [])

  // Restore draft
  useEffect(() => {
    if (!draftKey) return
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.form)         setForm({ ...EMPTY_FORM, ...d.form })
      if (d.mainCategory) setMainCategory(d.mainCategory)
      if (d.subCategory)  setSubCategory(d.subCategory)
      if (d.vehicleType)  setVehicleType(d.vehicleType)
      if (d.step)         setStep(d.step)
      if (d.eventSearch)  setEventSearch(d.eventSearch)
    } catch { /* ignore */ }
  }, [draftKey])

  // Save draft
  useEffect(() => {
    if (!draftKey) return
    try {
      localStorage.setItem(draftKey, JSON.stringify({ form, mainCategory, subCategory, vehicleType, step, eventSearch }))
    } catch { /* ignore */ }
  }, [draftKey, form, mainCategory, subCategory, vehicleType, step, eventSearch])

  const filteredEvents = events.filter(ev =>
    !eventSearch ||
    ev.eventName.toLowerCase().includes(eventSearch.toLowerCase()) ||
    (ev.eventCode ?? '').toLowerCase().includes(eventSearch.toLowerCase())
  )

  function selectEvent(ev: TravelEvent) {
    setForm(p => ({ ...p, eventId: ev.id }))
    setEventSearch(`${ev.eventName} (${ev.eventCode})`)
    setEventDropOpen(false)
  }

  function closeForm() {
    if (draftKey) localStorage.removeItem(draftKey)
    onCancel()
  }

  function selectSubCat(key: string) {
    setSubCategory(key)
    setError('')
    setStep(3)
  }

  function expNext() {
    if (step === 1) {
      if (isOnBehalf && !form.employeeId) { setError('Please select an employee.'); return }
      if (!form.eventId) { setError('Please select an event.'); return }
    }
    if (step === 3) {
      if (!form.amountUsd || Number(form.amountUsd) <= 0) { setError('Please enter a valid amount.'); return }
      if (!form.description.trim()) { setError('Please enter a description.'); return }
      if (!form.reason.trim()) { setError('Please enter a reason for this expense.'); return }
    }
    setError('')
    setStep(s => s + 1)
  }

  async function handleSubmit() {
    if (!pendingFile) { setError('A receipt is required — please attach a receipt before submitting.'); return }
    setLoading(true)
    setError('')

    const mapped = SUB_CATEGORY_MAP[subCategory] ?? { category: 'OTHER', service: 'Other' }
    const finalDescription = subCategory === 'CAR_RENTAL' && vehicleType
      ? `Vehicle: ${vehicleType}${form.description ? '. ' + form.description : ''}`
      : form.description

    // Start compression in parallel with the API call
    const compressPromise = pendingFile ? compressImageFile(pendingFile) : Promise.resolve(null)

    const { employeeId, ...rest } = form
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...rest,
        ...(isOnBehalf && employeeId ? { employeeId } : {}),
        description: finalDescription,
        category: mapped.category,
        service: mapped.service,
        amountUsd: Number(form.amountUsd),
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
      setLoading(false)
      return
    }

    let notice: string | undefined
    if (pendingFile && data.expense) {
      const compressed = await compressPromise
      const fd = new FormData()
      fd.append('file', compressed as File)
      fd.append('expenseId', data.expense.id)
      const uploadRes = await fetch('/api/receipts/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) {
        let msg = `HTTP ${uploadRes.status}`
        try { const d = await uploadRes.json(); if (d?.error) msg = d.error } catch {}
        notice = `Your expense was saved, but the receipt could not be uploaded (${msg}). Click "Attach missing receipt" on the expense row below to attach it.`
      }
    }

    if (draftKey) localStorage.removeItem(draftKey)
    setLoading(false)
    onSaved(notice)
  }

  // Derived helpers
  const subCatInfo = subCategory ? (SUB_CATEGORIES[mainCategory] ?? []).find(s => s.key === subCategory) : null
  const mainCatInfo = mainCategory ? MAIN_CATEGORIES.find(m => m.key === mainCategory) : null
  const currentEmoji = subCatInfo?.emoji ?? mainCatInfo?.emoji ?? '📎'
  const currentLabel = subCatInfo?.label ?? ''
  const cfg = subCategory ? SERVICE_DETAIL_CONFIG[subCategory] : null
  const selectedEvent = events.find(e => e.id === form.eventId)
  const selectedEmployee = employees?.find(e => e.id === form.employeeId)

  return (
    <div>
      {/* Progress bar */}
      <div className="flex items-center mb-6">
        {(['Event', 'Type', 'Details', 'Review'] as const).map((label, i) => {
          const n = i + 1; const done = step > n; const active = step === n
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-indigo-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {done ? <Check className="w-4 h-4" /> : n}
                </div>
                <span className={`mt-1 text-xs font-medium hidden sm:block ${active ? 'text-indigo-600' : done ? 'text-indigo-400' : 'text-gray-400'}`}>{label}</span>
              </div>
              {i < 3 && <div className={`flex-1 h-0.5 mx-2 rounded transition-colors ${step > n ? 'bg-indigo-400' : 'bg-gray-200'}`} />}
            </div>
          )
        })}
      </div>

      <div className="space-y-6" onKeyDown={advanceOnEnter}>

        {/* ─── Step 1: Event ──────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Select event</h2>
              <p className="text-sm text-gray-500">Choose the event this expense is for.</p>
            </div>

            {isOnBehalf ? (
              <Field label="Employee" required>
                <select title="Employee" value={form.employeeId}
                  onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
                  className={inputCls}>
                  <option value="">Select employee…</option>
                  {employees!.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </Field>
            ) : manager && (
              <div className="rounded-xl bg-indigo-50 px-4 py-3 text-sm">
                <span className="text-indigo-800"><span className="font-medium">Will be approved by:</span> {manager.name} ({manager.email})</span>
              </div>
            )}

            <div className="relative flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Event<span className="text-red-500 ml-0.5">*</span></label>
              <input
                type="text" value={eventSearch}
                onChange={e => { setEventSearch(e.target.value); setForm(p => ({ ...p, eventId: '' })); setEventDropOpen(true) }}
                onFocus={() => setEventDropOpen(true)}
                onBlur={() => setTimeout(() => setEventDropOpen(false), 150)}
                placeholder="Search events…" autoComplete="off" className={inputCls}
              />
              {eventDropOpen && filteredEvents.length > 0 && (
                <div className="absolute top-full mt-1 w-full z-50 bg-white rounded-xl border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
                  {filteredEvents.map(ev => (
                    <button key={ev.id} type="button" onMouseDown={() => selectEvent(ev)}
                      className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm text-gray-800 border-b border-gray-50 last:border-0">
                      <span className="font-medium">{ev.eventName}</span>
                      <span className="text-gray-400 ml-1 text-xs">· {ev.eventCode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 2: Expense Type (2-level) ─────────────── */}
        {step === 2 && (
          <div>
            {!mainCategory ? (
              /* Phase A: Main categories */
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Type of expense</h2>
                <p className="text-sm text-gray-500 mb-5">Select the main category.</p>
                <div className="grid grid-cols-2 gap-3">
                  {MAIN_CATEGORIES.map(({ key, label, emoji }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'OTHER') {
                          setMainCategory('OTHER'); setSubCategory('OTHER'); setError(''); setStep(3)
                        } else {
                          setMainCategory(key)
                        }
                      }}
                      className="rounded-2xl border-2 border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 p-6 flex flex-col items-center gap-3 transition-all group"
                    >
                      <span className="text-4xl group-hover:scale-110 transition-transform select-none">{emoji}</span>
                      <span className="text-sm font-semibold text-gray-800">{label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Phase B: Subcategories */
              <>
                <div className="flex items-center gap-2 mb-5">
                  <button
                    type="button"
                    onClick={() => { setMainCategory(''); setSubCategory('') }}
                    className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                  >
                    ← Change
                  </button>
                  <span className="text-gray-200">/</span>
                  {(() => { const mc = MAIN_CATEGORIES.find(m => m.key === mainCategory); return mc ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-base select-none">{mc.emoji}</span>
                      <span className="text-sm font-semibold text-gray-700">{mc.label}</span>
                    </div>
                  ) : null })()}
                </div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Select type</h2>
                <p className="text-sm text-gray-500 mb-4">Choose the specific expense type.</p>
                <div className={`grid gap-3 ${(SUB_CATEGORIES[mainCategory]?.length ?? 0) > 4 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2'}`}>
                  {(SUB_CATEGORIES[mainCategory] ?? []).map(({ key, label, emoji }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectSubCat(key)}
                      className="rounded-2xl border-2 border-gray-200 bg-white hover:border-indigo-500 hover:bg-indigo-600 hover:text-white p-4 flex flex-col items-center gap-2 transition-all group"
                    >
                      <span className="text-3xl select-none group-hover:scale-110 transition-transform">{emoji}</span>
                      <span className="text-xs font-semibold text-gray-700 group-hover:text-white transition-colors text-center leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Step 3: Details ─────────────────────────────── */}
        {step === 3 && cfg && (
          <div className="space-y-4">
            {/* Type header */}
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 border-l-4 border-indigo-600 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl select-none">{currentEmoji}</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-400">{mainCatInfo?.label}</p>
                  <p className="font-semibold text-indigo-900 leading-tight">{currentLabel}</p>
                </div>
              </div>
              <button type="button" onClick={() => { setStep(2); setSubCategory('') }} className="text-xs text-indigo-500 hover:underline">Change</button>
            </div>

            {subCategory === 'CAR_RENTAL' && (
              <Field label="Type of vehicle">
                <select title="Type of vehicle" value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={inputCls}>
                  <option value="">Select type…</option>
                  <option value="Economy">Economy</option>
                  <option value="Compact">Compact</option>
                  <option value="SUV">SUV</option>
                  <option value="Van">Van</option>
                  <option value="Minibus">Minibus</option>
                  <option value="Luxury">Luxury</option>
                </select>
              </Field>
            )}

            <Field label={cfg.merchantLabel}>
              <input type="text" value={form.merchantName}
                onChange={e => setForm(p => ({ ...p, merchantName: e.target.value }))}
                placeholder={cfg.merchantPlaceholder} className={inputCls} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Amount (USD)" required>
                <input type="text" inputMode="decimal" autoComplete="off" value={form.amountUsd}
                  onChange={e => setForm(p => ({ ...p, amountUsd: sanitizeAmountInput(e.target.value) }))}
                  placeholder="45.00" className={inputCls} />
              </Field>
              <Field label="Date">
                <DateInput title="Date" value={form.transactionDate}
                  onChange={v => setForm(p => ({ ...p, transactionDate: v }))} className={inputCls} />
              </Field>
            </div>

            <Field label="Description" required>
              <input type="text" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder={cfg.descPlaceholder} className={inputCls} />
            </Field>

            <Field label="Reason for expense" required>
              <input type="text" value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="E.g. Client meeting, business travel" className={inputCls} />
            </Field>

            <Field label="Name of person (who it was for)">
              <input type="text" value={form.personName}
                onChange={e => setForm(p => ({ ...p, personName: e.target.value }))}
                placeholder="E.g. Jane Doe (leave blank if for yourself)" className={inputCls} />
            </Field>

            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-700">Receipt<span className="text-red-500 ml-0.5">*</span></p>
              <FileUpload
                label="Drag & drop or click to upload"
                hint="JPG, PNG, PDF, WebP — max 10 MB"
                file={pendingFile}
                onFile={setPendingFile}
                onClear={() => setPendingFile(null)}
              />
            </div>
          </div>
        )}

        {/* ─── Step 4: Review ──────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Review your expense</h2>
              <p className="text-sm text-gray-500">Double-check everything before submitting.</p>
            </div>

            {isOnBehalf && selectedEmployee && (
              <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Employee</p>
                <p className="font-semibold text-gray-900">{selectedEmployee.name}</p>
              </div>
            )}

            {selectedEvent && (
              <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Event</p>
                <p className="font-semibold text-gray-900">{selectedEvent.eventName}</p>
                {selectedEvent.eventCode && <p className="text-sm text-gray-500">{selectedEvent.eventCode}</p>}
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xl select-none">{currentEmoji}</span>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">{mainCatInfo?.label}</p>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{currentLabel}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setStep(3)} className="text-xs text-indigo-600 font-medium hover:underline">Edit</button>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Amount</span><span className="text-gray-900 font-medium">${Number(form.amountUsd || 0).toFixed(2)}</span></div>
                {form.transactionDate && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Date</span><span className="text-gray-900 font-medium">{new Date(form.transactionDate + 'T12:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span></div>}
                {form.merchantName && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Merchant</span><span className="text-gray-900 font-medium">{form.merchantName}</span></div>}
                {vehicleType && subCategory === 'CAR_RENTAL' && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Vehicle type</span><span className="text-gray-900 font-medium">{vehicleType}</span></div>}
                {form.description && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Description</span><span className="text-gray-900 font-medium">{form.description}</span></div>}
                {form.reason && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Reason</span><span className="text-gray-900 font-medium">{form.reason}</span></div>}
                {form.personName && <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Expense for</span><span className="text-gray-900 font-medium">{form.personName}</span></div>}
                <div className="flex gap-2 text-sm"><span className="text-gray-400 w-32 shrink-0">Receipt</span><span className="text-gray-900 font-medium">{pendingFile ? pendingFile.name : <span className="text-amber-600">None — required</span>}</span></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</p>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-1 justify-between">
          {step > 1 ? (
            <button type="button"
              onClick={() => {
                setError('')
                if (step === 2 && mainCategory) { setMainCategory(''); setSubCategory('') }
                else setStep(s => s - 1)
              }}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              ← Back
            </button>
          ) : (
            <button type="button" onClick={closeForm}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          )}
          {/* Hide Next on step 2 — subcategory click auto-advances */}
          {step !== 2 && (
            step < 4 ? (
              <button type="button" onClick={expNext}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors">
                Next →
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={loading}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold transition-colors">
                {loading ? 'Saving…' : 'Save expense'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
