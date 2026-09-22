'use client'

import { Combobox } from '@/components/ui/Combobox'
import type { TravelEvent } from '@/types/event'

function fmtDisplayDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

interface EventComboboxProps {
  value: TravelEvent | null
  onChange: (ev: TravelEvent | null) => void
  events: TravelEvent[]
  className?: string
  placeholder?: string
}

/** Event picker shared by the travel-request wizard, the agent booking flow, and the expense wizard. */
export function EventCombobox({ value, onChange, events, className, placeholder = 'Search events…' }: EventComboboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <Combobox<TravelEvent>
        items={events}
        selectedItem={value}
        onSelectedItemChange={onChange}
        itemToString={(ev) => ev?.eventName ?? ''}
        itemToKey={(ev) => ev.id}
        filterItems={(evs, query) => {
          if (!query) return evs
          const lower = query.toLowerCase()
          return evs.filter((ev) => ev.eventName.toLowerCase().includes(lower) || (ev.eventCode ?? '').toLowerCase().includes(lower))
        }}
        label="Event"
        required
        placeholder={placeholder}
        emptyMessage="No events found"
        className={className}
        clearable
        renderItem={(ev, { isSelected }) => (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{ev.eventName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {ev.eventCode && <span className="font-mono">{ev.eventCode}</span>}
                {ev.dateStart ? ` · ${fmtDisplayDate(new Date(ev.dateStart).toISOString().split('T')[0])}` : ''}
              </p>
            </div>
            {isSelected && (
              <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
      />
      {value && (
        <p className="text-xs text-gray-500">
          {value.eventCode && <span className="font-mono font-medium text-indigo-600">{value.eventCode}</span>}
          {value.dateStart ? ` · ${fmtDisplayDate(new Date(value.dateStart).toISOString().split('T')[0])}` : ''}
        </p>
      )}
    </div>
  )
}
