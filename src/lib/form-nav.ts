import type { KeyboardEvent } from 'react'

// Attach to a form container's onKeyDown. Pressing Enter in a text input/select
// moves focus to the next visible field instead of doing nothing (or submitting),
// for fast keyboard data entry. Textareas keep their normal multi-line behavior,
// and Ctrl/Cmd+Enter is left alone so it can be used for submit shortcuts.
export function advanceOnEnter(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return

  const target = e.target as HTMLElement
  const tag = target.tagName
  if (tag !== 'INPUT' && tag !== 'SELECT') return
  if ((target as HTMLInputElement).type === 'submit') return

  e.preventDefault()

  const fields = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled])'
    )
  ).filter((el) => el.offsetParent !== null)

  const i = fields.indexOf(target)
  if (i > -1 && i + 1 < fields.length) fields[i + 1].focus()
  else target.blur()
}
