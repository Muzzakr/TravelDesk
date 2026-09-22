'use client'

import { useEffect, useState } from 'react'
import { useCombobox } from 'downshift'

export interface ComboboxRenderState {
  isHighlighted: boolean
  isSelected: boolean
}

export interface ComboboxProps<T> {
  items: T[]
  selectedItem: T | null
  onSelectedItemChange: (item: T | null) => void
  itemToString: (item: T | null) => string
  /** Defaults to `itemToString` — override when labels can collide (e.g. duplicate city names). */
  itemToKey?: (item: T) => string
  /** Defaults to a case-insensitive substring match on `itemToString`. */
  filterItems?: (items: T[], query: string) => T[]
  renderItem: (item: T, state: ComboboxRenderState) => React.ReactNode
  label?: string
  placeholder?: string
  emptyMessage?: string
  required?: boolean
  className?: string
  id?: string
  /** Shows a small "×" button that clears the selection while keeping focus. */
  clearable?: boolean
  /**
   * Free-text mode: called on every keystroke, not just on picking a
   * suggestion — for fields where suggestions are optional hints rather
   * than a closed list (e.g. a city/location field that also accepts
   * anything the user types). Leave unset for "must pick from the list"
   * fields (e.g. Event, Airport).
   */
  onInputValueChange?: (value: string) => void
}

const defaultInputCls =
  'rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white'

function defaultFilter<T>(items: T[], query: string, itemToString: (item: T | null) => string): T[] {
  if (!query) return items
  const lower = query.toLowerCase()
  return items.filter((item) => itemToString(item).toLowerCase().includes(lower))
}

/**
 * Accessible combobox built on downshift's `useCombobox` — supplies the
 * correct `role="combobox"` / `aria-expanded` / `aria-activedescendant` /
 * `listbox`+`option` roles and arrow/enter/escape keyboard handling, which
 * this codebase's earlier hand-rolled comboboxes never had.
 *
 * Re-filters whenever `items` (the source list) OR the typed query changes
 * — not just at focus time — so a combobox opened before its data finished
 * loading asynchronously still shows results once it arrives, instead of
 * staying stuck empty until the next full re-mount.
 */
export function Combobox<T>({
  items,
  selectedItem,
  onSelectedItemChange,
  itemToString,
  itemToKey,
  filterItems,
  renderItem,
  label,
  placeholder,
  emptyMessage = 'No results found',
  required,
  className,
  id,
  clearable,
  onInputValueChange,
}: ComboboxProps<T>) {
  const [query, setQuery] = useState('')
  const [inputItems, setInputItems] = useState<T[]>(items)

  useEffect(() => {
    setInputItems(filterItems ? filterItems(items, query) : defaultFilter(items, query, itemToString))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query])

  const {
    isOpen,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getItemProps,
    highlightedIndex,
    selectItem,
  } = useCombobox({
    items: inputItems,
    itemToString,
    selectedItem,
    onSelectedItemChange: ({ selectedItem }) => onSelectedItemChange(selectedItem ?? null),
    onInputValueChange: ({ inputValue }) => {
      setQuery(inputValue ?? '')
      onInputValueChange?.(inputValue ?? '')
    },
  })

  return (
    <div className="relative flex flex-col gap-1">
      {label && (
        <label {...getLabelProps()} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          {...getInputProps({ id, placeholder, autoComplete: 'off' })}
          className={className ?? defaultInputCls}
        />
        {clearable && selectedItem && (
          <button
            type="button"
            onClick={() => selectItem(null)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear selection"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {/*
        The empty-results message is deliberately NOT rendered inside the
        <ul role="listbox"> below — a bare <li> with no role="option" there
        violates the ARIA listbox pattern (axe: aria-required-children) and
        real screen readers can announce it oddly. It's a sibling instead,
        positioned identically, shown only when the list itself has nothing.
      */}
      {isOpen && inputItems.length === 0 && (
        <p
          role="status"
          className="absolute top-full mt-1 w-full z-50 rounded-xl border border-gray-200 bg-white shadow-lg px-3 py-4 text-sm text-gray-400 text-center"
        >
          {emptyMessage}
        </p>
      )}
      <ul
        {...getMenuProps()}
        className={`absolute top-full mt-1 w-full z-50 rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto ${
          isOpen && inputItems.length > 0 ? '' : 'hidden'
        }`}
      >
        {isOpen &&
          inputItems.map((item, index) => {
            const itemKey = itemToKey ? itemToKey(item) : itemToString(item)
            const isSelected = selectedItem !== null && (itemToKey ? itemToKey(selectedItem) === itemKey : itemToString(selectedItem) === itemKey)
            return (
              <li
                key={`${index}-${itemKey}`}
                {...getItemProps({ item, index })}
                className={`cursor-pointer px-3 py-2.5 text-sm border-b border-gray-50 last:border-0 ${
                  highlightedIndex === index ? 'bg-indigo-50' : ''
                }`}
              >
                {renderItem(item, { isHighlighted: highlightedIndex === index, isSelected })}
              </li>
            )
          })}
      </ul>
    </div>
  )
}
