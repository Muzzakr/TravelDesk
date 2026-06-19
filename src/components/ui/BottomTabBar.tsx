'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Inbox, Plane, Receipt, CheckCircle2, BarChart3, Wallet,
  Users, Calendar, User, Workflow, Settings, MoreHorizontal, X, Circle, type LucideIcon,
} from 'lucide-react'

type NavLink = { label: string; href: string }
type NavItem = NavLink | { heading: string }

function iconFor(label: string): LucideIcon {
  const l = label.toLowerCase()
  if (l.includes('dashboard') || l.includes('home')) return LayoutDashboard
  if (l.includes('inbox')) return Inbox
  if (l.includes('approval')) return CheckCircle2
  if (l.includes('payout')) return Wallet
  if (l.includes('expense')) return Receipt
  if (l.includes('travel') || l.includes('trip') || l.includes('book')) return Plane
  if (l.includes('report') || l.includes('stat')) return BarChart3
  if (l.includes('event')) return Calendar
  if (l.includes('user') || l.includes('employee')) return Users
  if (l.includes('profile')) return User
  if (l.includes('workflow')) return Workflow
  if (l.includes('policy') || l.includes('card') || l.includes('setting')) return Settings
  return Circle
}

const SHORT: Record<string, string> = {
  'Dashboard': 'Home',
  'Admin Dashboard': 'Home',
  'Travel Inbox': 'Inbox',
  'Travel Requests': 'Trips',
  'Team Travel': 'Travel',
  'Team Expenses': 'Expenses',
  'Payout Reports': 'Payouts',
  'Monthly Reports': 'Reports',
  'Create Travel Booking': 'Book',
  'My Profile': 'Profile',
  'Card Transactions': 'Cards',
  'Users & Roles': 'Users',
}
function shortLabel(label: string): string {
  return SHORT[label] ?? label.replace(/^(Team|Travel) /, '')
}

export function BottomTabBar({ nav, userName, role, logoutAction }: {
  nav: NavItem[]
  userName: string
  role: string
  logoutAction: () => Promise<void>
}) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const links = nav.filter((i): i is NavLink => !('heading' in i))
  const tabs = links.slice(0, 4)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {tabs.map((item) => {
            const Icon = iconFor(item.label)
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${active ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-[68px] truncate">{shortLabel(item.label)}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-gray-500 hover:text-gray-800"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} />
          <aside className="relative ml-auto flex h-full w-72 max-w-[85vw] flex-col bg-indigo-900 text-white pt-[env(safe-area-inset-top)]">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-base font-bold">Menu</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close menu" className="rounded-lg p-2 hover:bg-indigo-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {nav.map((item, i) =>
                'heading' in item ? (
                  <p key={i} className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400">{item.heading}</p>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-indigo-100 hover:bg-indigo-800 hover:text-white"
                  >
                    {(() => { const Icon = iconFor(item.label); return <Icon className="h-4 w-4 shrink-0" /> })()}
                    {item.label}
                  </Link>
                )
              )}
            </nav>
            <div className="border-t border-indigo-800 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="mb-3 text-xs text-indigo-300">{role.replace(/_/g, ' ')}</p>
              <form action={logoutAction}>
                <button type="submit" className="w-full rounded-lg bg-indigo-800 px-3 py-2.5 text-left text-sm font-medium text-indigo-200 hover:bg-indigo-700 hover:text-white">
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
