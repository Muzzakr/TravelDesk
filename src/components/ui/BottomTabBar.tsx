'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Inbox, Plane, Receipt, CheckCircle2, BarChart3, Wallet,
  Users, Calendar, User, Workflow, Settings, MoreHorizontal, X, Circle,
  LogOut, type LucideIcon,
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
  TRAVEL_MANAGER: ['/manager', '/manager/inbox', '/manager/team-travel', '/agent/book'],
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

  const links = nav.filter((i): i is NavLink => !('heading' in i))
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

      {/* ── Drawer (slides from left) ── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMoreOpen(false)}
          />

          {/* Panel */}
          <aside className="animate-slide-in-left relative flex h-full w-72 max-w-[85vw] flex-col bg-white pt-[env(safe-area-inset-top)] shadow-2xl">

            {/* Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
              <span className="text-sm font-bold tracking-tight text-gray-900">M4U Travel</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User card */}
            <div className="shrink-0 border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight text-gray-900">{userName}</p>
                  <p className="mt-0.5 text-xs leading-tight text-gray-400">
                    {ROLE_LABEL[role] ?? role.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {nav.map((item, i) =>
                'heading' in item ? (
                  <p
                    key={i}
                    className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-widest text-gray-400"
                  >
                    {item.heading}
                  </p>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-100 ${
                      isActive(item.href)
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {(() => {
                      const Icon = iconFor(item.label)
                      return (
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive(item.href)
                              ? 'text-indigo-600'
                              : 'text-gray-400 group-hover:text-gray-600'
                          }`}
                        />
                      )
                    })()}
                    <span className="flex-1">{item.label}</span>
                    {isActive(item.href) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    )}
                  </Link>
                )
              )}
            </nav>

            {/* Logout */}
            <div className="shrink-0 border-t border-gray-100 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors duration-100 hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4 text-gray-400 transition-colors group-hover:text-red-500" />
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
