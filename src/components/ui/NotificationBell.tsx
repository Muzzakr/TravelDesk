'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Plane, CreditCard, Ticket, Wallet, RefreshCw, Bell, type LucideIcon } from 'lucide-react'

type Notification = {
  id: string
  type: string
  title: string
  description: string
  href: string
  time: string
  read: boolean
}

const typeIcon: Record<string, LucideIcon> = {
  travel_pending: Plane,
  expense_pending: CreditCard,
  travel_booked: Ticket,
  expense_paid: Wallet,
  workflow_update: RefreshCw,
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotifications() {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  const unread = notifications.filter((n) => !n.read).length

  async function markAllRead() {
    try { await fetch('/api/notifications', { method: 'PATCH' }) } catch { /* ignore */ }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function toggleOpen() {
    setOpen((o) => {
      const next = !o
      if (next && unread > 0) markAllRead()
      return next
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-indigo-800 transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-3 top-[calc(3.5rem+env(safe-area-inset-top))] z-50 w-[calc(100vw-1.5rem)] max-w-sm sm:w-80 rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unread > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {unread} new
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No notifications</div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={`flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
                >
                  {(() => { const Icon = typeIcon[n.type] ?? Bell; return <Icon className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" /> })()}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{n.description}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{n.time}</p>
                  </div>
                  {!n.read && <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
                </Link>
              ))
            )}
          </div>

          <div className="border-t px-4 py-2">
            <button
              onClick={() => { fetchNotifications(); setOpen(false) }}
              className="text-xs text-indigo-600 hover:underline"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
