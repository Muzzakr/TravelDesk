'use client'

import { useState, useRef, useEffect } from 'react'

const roleLabel: Record<string, string> = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  TRAVEL_AGENT: 'Travel Agent',
  FINANCE_ADMIN: 'Finance Admin',
  SYSTEM_ADMIN: 'System Admin',
}

export function DashboardHeader({
  name,
  email,
  role,
  logoutAction,
}: {
  name: string
  email: string
  role: string
  logoutAction: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="hidden md:flex h-14 items-center justify-end px-6 bg-white border-b border-gray-100 flex-shrink-0">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
        >
          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          {/* Name + role */}
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{name}</p>
            <p className="text-[11px] text-gray-400 leading-tight">{roleLabel[role] ?? role.replace(/_/g, ' ')}</p>
          </div>
          {/* Chevron */}
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-gray-200 bg-white shadow-lg py-1">
            {/* User info */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
              <p className="text-xs text-gray-400 truncate">{email}</p>
              <span className="mt-1.5 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                {roleLabel[role] ?? role.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Actions */}
            <div className="py-1">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Log out
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
