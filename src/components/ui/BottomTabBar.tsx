'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Inbox, Plane, Receipt, CheckCircle2, BarChart3, Wallet,
  Users, Calendar, User, Workflow, Settings, MoreHorizontal, X, Circle,
  LogOut, type LucideIcon,
} from 'lucide-react'
import { useModalDismiss } from '@/lib/use-modal-dismiss'

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
  'All Expenses': 'Expenses',
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

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  TRAVEL_AGENT: 'Travel Agent',
  FINANCE_ADMIN: 'Finance Admin',
  SYSTEM_ADMIN: 'System Admin',
}

// Priority hrefs pinned as tabs per role (up to 4)
const PRIORITY_TABS: Record<string, string[]> = {
  SYSTEM_ADMIN: ['/admin', '/admin/expenses', '/admin/users', '/admin/events'],
  FINANCE_ADMIN: ['/finance', '/finance/expenses', '/finance/payout-reports', '/finance/cards'],
  MANAGER: ['/manager', '/manager/inbox', '/manager/team-travel', '/finance/expenses'],
  TRAVEL_MANAGER: ['/manager', '/finance/expenses', '/manager/team-travel', '/agent/book'],
}

export function BottomTabBar({
  nav,
  userName,
  role,
  logoutAction,
}: {
  nav: NavItem[]
  userName: string
  role: string
  logoutAction: () => Promise<void>
}) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const sheetRef = useModalDismiss<HTMLDivElement>(moreOpen, () => setMoreOpen(false))

  const links = nav.filter((i): i is NavLink => !('heading' in i))

  // Group flat nav (headings interleaved with links) into sections for the grid
  const sections: { heading: string | null; links: NavLink[] }[] = []
  for (const item of nav) {
    if ('heading' in item) {
      sections.push({ heading: item.heading, links: [] })
    } else {
      if (sections.length === 0) sections.push({ heading: null, links: [] })
      sections[sections.length - 1].links.push(item)
    }
  }
  const priorityHrefs = PRIORITY_TABS[role]
  const tabs = priorityHrefs
    ? priorityHrefs.map(h => links.find(l => l.href === h)).filter((l): l is NavLink => !!l)
    : links.slice(0, 4)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      {/* ── Bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white pb-[env(safe-area-inset-bottom)] shadow-tab-bar">
        <div className="grid grid-cols-5">
          {tabs.map((item) => {
            const Icon = iconFor(item.label)
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1"
              >
                <span
                  className={`flex items-center justify-center rounded-[10px] px-3 py-1 transition-all duration-150 ${
                    active ? 'bg-indigo-50' : ''
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-colors duration-150 ${
                      active ? 'text-indigo-600' : 'text-gray-400'
                    }`}
                  />
                </span>
                <span
                  className={`text-[11px] font-medium tracking-tight transition-colors duration-150 ${
                    active ? 'text-indigo-600' : 'text-gray-400'
                  }`}
                >
                  {shortLabel(item.label)}
                </span>
              </Link>
            )
          })}

          {/* More */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Open menu"
            className="flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1"
          >
            <span className="flex items-center justify-center rounded-[10px] px-3 py-1">
              <MoreHorizontal className="h-5 w-5 text-gray-400" />
            </span>
            <span className="text-[11px] font-medium tracking-tight text-gray-400">More</span>
          </button>
        </div>
      </nav>

      {/* ── Full-screen "More" menu (slides up) ── */}
      {moreOpen && (
        <div
          ref={sheetRef}
          className="animate-slide-up md:hidden fixed inset-0 z-50 flex flex-col bg-white pt-[env(safe-area-inset-top)]"
        >
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-gray-900">{userName}</p>
                <p className="text-[11px] leading-tight text-gray-400">
                  {ROLE_LABEL[role] ?? role.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label="Close menu"
              className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Grid of destinations, grouped by section */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {sections.map((section, si) => (
              <div key={si}>
                {section.heading && (
                  <p className="pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {section.heading}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {section.links.map((item) => {
                    const Icon = iconFor(item.label)
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 transition-colors ${
                          active
                            ? 'border-indigo-200 bg-indigo-50'
                            : 'border-gray-100 bg-gray-50/50 active:bg-gray-100'
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            active ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 shadow-sm'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span
                          className={`text-center text-xs font-medium leading-tight ${
                            active ? 'text-indigo-700' : 'text-gray-600'
                          }`}
                        >
                          {shortLabel(item.label)}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Logout */}
          <div className="shrink-0 border-t border-gray-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <form action={logoutAction}>
              <button
                type="submit"
                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-3 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              >
                <LogOut className="h-4 w-4 text-gray-400 transition-colors group-hover:text-red-500" />
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
