'use client'

import { Combobox } from '@/components/ui/Combobox'
import { AIRPORTS, type AirportOption } from '@/lib/travel-locations'

interface AirportComboboxProps {
  value: AirportOption | null
  onChange: (a: AirportOption | null) => void
  placeholder: string
  label: string
  required?: boolean
  className?: string
}

/** Airport picker shared by the travel-request wizard and the agent booking flow. */
export function AirportCombobox({ value, onChange, placeholder, label, required, className }: AirportComboboxProps) {
  return (
    <Combobox<AirportOption>
      items={AIRPORTS}
      selectedItem={value}
      onSelectedItemChange={onChange}
      itemToString={(a) => (a ? `${a.name} (${a.code})` : '')}
      itemToKey={(a) => a.code}
      filterItems={(airports, query) => {
        if (!query) return []
        const lower = query.toLowerCase()
        return airports
          .filter((a) => a.code.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower) || a.city.toLowerCase().includes(lower))
          .slice(0, 8)
      }}
      label={label}
      required={required}
      placeholder={placeholder}
      emptyMessage="No airports found"
      className={className}
      renderItem={(a) => (
        <div className="flex items-center justify-between gap-2">
          <span>
            <span className="font-medium text-gray-900">{a.name}</span>
            <span className="text-gray-400 ml-1 text-xs">
              · {a.city}, {a.country}
            </span>
          </span>
          <span className="text-xs font-bold text-indigo-600 shrink-0">{a.code}</span>
        </div>
      )}
    />
  )
}
