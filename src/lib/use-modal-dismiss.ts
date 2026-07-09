'use client'

import { useEffect, useRef } from 'react'

/**
 * Escape-to-close + focus management for hand-rolled overlays
 * (fixed inset-0 modals/drawers that don't use the native <dialog>).
 *
 * - Escape closes the overlay
 * - Focus moves to the first focusable element inside when it opens
 * - Focus returns to the previously focused element when it closes
 *
 * Usage:
 *   const modalRef = useModalDismiss<HTMLDivElement>(open, () => setOpen(false))
 *   ...
 *   {open && <div ref={modalRef} className="fixed inset-0 ...">...</div>}
 */
export function useModalDismiss<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement as HTMLElement | null

    // Focus the first focusable element inside the overlay
    const container = containerRef.current
    const focusable = container?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    focusable?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      restoreRef.current?.focus?.()
    }
  }, [open])

  return containerRef
}
