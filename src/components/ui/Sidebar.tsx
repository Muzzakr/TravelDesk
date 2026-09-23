'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { navIcon } from '@/lib/nav-icons'
import { CompanyBrand } from '@/components/ui/CompanyBrand'
import { NotificationBell } from '@/components/ui/NotificationBell'
import type { Role } from '@/types/user'

type NavLink = { label: string; href: string }
type NavItem = NavLink | { heading: string }

interface SidebarProps {
  variant: 'solid' | 'glass'
  nav: NavItem[]
  companyName: string
  logoUrl: string | null
  userName: string
  role: Role
  /** Keyed by href. Glass variant only — the solid variant never shows badges. */
  badgeCounts?: Partial<Record<string, number>>
  logoutAction: () => Promise<void>
}

const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  TRAVEL_MANAGER: 'Travel Manager',
  TRAVEL_AGENT: 'Travel Agent',
  FINANCE_ADMIN: 'Finance Admin',
  SYSTEM_ADMIN: 'System Admin',
}

export function Sidebar({ variant, nav, companyName, logoUrl, userName, role, badgeCounts, logoutAction }: SidebarProps) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  if (variant === 'glass') {
    const initials = userName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

    return (
      <aside className="hidden md:flex md:w-[76px] lg:w-[248px] shrink-0 flex-col sticky top-4 self-start h-[calc(100vh-2rem)] mx-3 my-4 lg:mx-4">
        <div className="relative flex-1 flex flex-col rounded-[18px] border border-white/10 shadow-[0_8px_32px_rgba(30,27,75,0.35)] overflow-hidden">
          {/* Decorative blur layer — a sibling of the content, never an ancestor of
              NotificationBell's fixed-position dropdown. backdrop-filter promotes its
              element to a new containing block for fixed descendants, which would
              otherwise clip/mislocate the dropdown inside this narrow column. */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#1e1b4b]/90 via-[#1e2266]/85 to-[#1e1b4b]/90 backdrop-blur-md" />

          <div className="relative flex flex-1 flex-col overflow-y-auto">
            {/* Header — stacked (logo above bell) in the narrow icon rail, side-by-side once full width kicks in */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-3 lg:px-5 pt-5 pb-4 gap-2">
              <CompanyBrand name={companyName} logoUrl={logoUrl} size="md" className="lg:min-w-0" nameClassName="hidden lg:inline" />
              <div className="self-center lg:self-auto shrink-0">
                <NotificationBell />
              </div>
            </div>
            <p className="hidden lg:block px-5 -mt-2 pb-3 text-[10px] font-semibold uppercase tracking-widest text-blue-300/70">
              {ROLE_LABEL[role]}
            </p>
            <div className="mx-4 lg:mx-5 border-t border-white/10" />

            {/* Profile block */}
            <div className="flex items-center gap-3 px-4 lg:px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 border border-white/10 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="hidden lg:block min-w-0">
                <p className="text-sm font-semibold text-white truncate">{userName}</p>
                <p className="text-[11px] text-blue-200/70">My Account</p>
              </div>
            </div>
            <div className="mx-4 lg:mx-5 border-t border-white/10" />

            {/* Nav */}
            <nav className="flex-1 px-3 py-3 space-y-0.5">
              {nav.map((item, i) =>
                'heading' in item ? (
                  <p key={i} className="hidden lg:block px-3 pt-4 pb-1 text-[10px] font-bold text-blue-300/50 uppercase tracking-widest">
                    {item.heading}
                  </p>
                ) : (
                  (() => {
                    const Icon = navIcon(item.label)
                    const active = isActive(item.href)
                    const count = badgeCounts?.[item.href]
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                          active ? 'bg-blue-400/15 text-white' : 'text-indigo-100/90 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-blue-300' : 'text-indigo-300/70 group-hover:text-blue-300'}`} />
                        <span className="hidden lg:inline truncate">{item.label}</span>
                        {!!count && count > 0 && (
                          <span className="hidden lg:inline-flex ml-auto items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-400/20 text-blue-100 text-[11px] font-semibold border border-blue-300/20">
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </Link>
                    )
                  })()
                )
              )}
            </nav>

            {/* Footer */}
            <div className="mt-auto border-t border-white/10 px-3 py-3">
              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Log out"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-indigo-100/90 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0 text-indigo-300/70" />
                  <span className="hidden lg:inline">Log out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
    )
  }

  // ── Solid (default) variant — verbatim today's markup, unchanged for every other role ──
  return (
    <aside className="hidden md:flex w-64 flex-col bg-indigo-900 text-white">
      <div className="flex h-20 items-center justify-between px-4">
        <CompanyBrand name={companyName} logoUrl={logoUrl} size="md" />
        <NotificationBell />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map((item, i) =>
          'heading' in item ? (
            <p key={i} className="px-3 pt-4 pb-1 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              {item.heading}
            </p>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-800 hover:text-white"
            >
              {(() => { const Icon = navIcon(item.label); return <Icon className="h-4 w-4 shrink-0 text-indigo-400" /> })()}
              {item.label}
            </Link>
          )
        )}
      </nav>
      <div className="border-t border-indigo-800 px-6 py-4">
        <form action={logoutAction}>
          <button type="submit" className="w-full rounded-lg bg-indigo-800 px-3 py-2 text-left text-sm font-medium text-indigo-200 hover:bg-indigo-700 hover:text-white">
            Log out
          </button>
        </form>
      </div>
    </aside>
  )
}
