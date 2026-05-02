'use client'

import { useState } from 'react'
import Link from 'next/link'

interface NavItem { label: string; href: string }

export function MobileNav({ nav, userName, role, logoutAction }: {
  nav: NavItem[]
  userName: string
  role: string
  logoutAction: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex h-14 items-center justify-between bg-indigo-900 px-4 text-white">
        <span className="text-base font-bold">TravelDesk</span>
        <button onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-indigo-800" aria-label="Open menu">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-64 flex flex-col bg-indigo-900 text-white h-full">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-base font-bold">TravelDesk</span>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-indigo-800" aria-label="Close menu">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-800 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-indigo-800 px-6 py-4">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-xs text-indigo-300">{role.replace(/_/g, ' ')}</p>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="mt-3 w-full rounded-lg bg-indigo-800 px-3 py-2 text-left text-sm font-medium text-indigo-200 hover:bg-indigo-700 hover:text-white"
                >
                  Log out
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
