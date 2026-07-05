import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Role } from '@/types/user'
import { MobileNav } from '@/components/ui/MobileNav'
import { BottomTabBar } from '@/components/ui/BottomTabBar'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { ProfileBanner } from '@/components/ui/ProfileBanner'
import { getProfileStatus } from '@/lib/profile-check'
import { prisma } from '@/lib/prisma'
import {
  LayoutDashboard, Inbox, Plane, Receipt, CheckCircle2, BarChart3, Wallet,
  Users, Calendar, User, Workflow, Settings, Circle, type LucideIcon,
} from 'lucide-react'

function sidebarIcon(label: string): LucideIcon {
  const l = label.toLowerCase()
  if (l.includes('dashboard') || l.includes('home') || l.includes('admin')) return LayoutDashboard
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
  if (l.includes('policy') || l.includes('card') || l.includes('setting') || l.includes('audit')) return Settings
  return Circle
}

type NavItem = { label: string; href: string } | { heading: string }

const SECURITY_LINK = { label: 'Security', href: '/settings/security' }

const navByRole: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { label: 'Dashboard', href: '/employee' },
    { label: 'Travel Requests', href: '/employee/travel-requests' },
    { label: 'Expenses', href: '/employee/expenses' },
    { label: 'My Profile', href: '/employee/profile' },
    SECURITY_LINK,
  ],
  MANAGER: [
    { label: 'Dashboard', href: '/manager' },
    { heading: 'My Work' },
    { label: 'Travel Inbox', href: '/manager/inbox' },
    { label: 'Team Travel', href: '/manager/team-travel' },
    { label: 'Team Expenses', href: '/manager/team-expenses' },
    { heading: 'Finance' },
    { label: 'All Expenses', href: '/finance/expenses' },
    { label: 'Payout Reports', href: '/finance/payout-reports' },
    { label: 'Card Transactions', href: '/finance/cards' },
    { label: 'Finance Reports', href: '/finance/reports' },
    { heading: 'Administration' },
    { label: 'Employee', href: '/manager/users-roles' },
    { label: 'Workflows', href: '/manager/workflows' },
    { label: 'Monthly Reports', href: '/manager/reports' },
    SECURITY_LINK,
  ],
  TRAVEL_MANAGER: [
    { label: 'Dashboard', href: '/manager' },
    { heading: 'Travel' },
    { label: 'Travel Inbox', href: '/manager/inbox' },
    { label: 'Travel Requests', href: '/manager/team-travel' },
    { label: 'Open Requests', href: '/manager/requests/unassigned' },
    { heading: 'Finance' },
    { label: 'All Expenses', href: '/finance/expenses' },
    { label: 'Payout Reports', href: '/finance/payout-reports' },
    { label: 'Card Transactions', href: '/finance/cards' },
    { heading: 'Administration' },
    { label: 'Employees', href: '/manager/users-roles' },
    SECURITY_LINK,
  ],
  TRAVEL_AGENT: [
    { label: 'Dashboard', href: '/agent' },
    { label: 'Travel Inbox', href: '/agent/inbox' },
    { label: 'Travel Requests', href: '/agent/bookings' },
    { label: 'Create Travel Booking', href: '/agent/book' },
    SECURITY_LINK,
  ],
  FINANCE_ADMIN: [
    { label: 'Dashboard', href: '/finance' },
    { label: 'Expenses', href: '/finance/expenses' },
    { label: 'Payout Reports', href: '/finance/payout-reports' },
    { label: 'Monthly Reports', href: '/finance/reports' },
    { heading: 'Settings' },
    { label: 'Events & Budgets', href: '/finance/events' },
    { label: 'Policy Limits', href: '/finance/policy' },
    { label: 'Card Transactions', href: '/finance/cards' },
    SECURITY_LINK,
  ],
  SYSTEM_ADMIN: [
    { heading: 'Operations' },
    { label: 'Admin Dashboard',   href: '/admin' },
    { label: 'Travel Inbox',      href: '/manager/inbox' },
    { label: 'Travel Requests',   href: '/admin/travel-requests' },
    { label: 'Open Requests',     href: '/manager/requests/unassigned' },
    { label: 'Expenses',          href: '/admin/expenses' },
    { label: 'Card Transactions', href: '/finance/cards' },
    { heading: 'Finance' },
    { label: 'Payout Reports',    href: '/finance/payout-reports' },
    { label: 'Statistics',        href: '/admin/stats' },
    { heading: 'Management' },
    { label: 'Users',             href: '/admin/users' },
    { label: 'Events',            href: '/admin/events' },
    { label: 'Policy Limits',     href: '/finance/policy' },
    { label: 'Audit Log',         href: '/admin/audit-log' },
    { label: 'Settings',          href: '/admin/settings' },
    SECURITY_LINK,
  ],
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const role = session.user.role as Role
  const nav = navByRole[role] ?? navByRole.EMPLOYEE

  // Check profile completeness for roles that travel
  const profileStatus = await getProfileStatus(session.user.id, role)

  // Fetch company logo (only if companyId present)
  let logoUrl: string | null = null
  if (session.user.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { logoUrl: true },
    })
    logoUrl = company?.logoUrl ?? null
  }

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Mobile top bar (primary nav is the bottom tab bar) */}
      <MobileNav />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-indigo-900 text-white">
        <div className="flex h-16 items-center justify-between px-6">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Company logo" className="h-8 max-w-[120px] object-contain" />
          ) : (
            <span className="text-xl font-bold">M4U Travel</span>
          )}
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
                {(() => { const Icon = sidebarIcon(item.label); return <Icon className="h-4 w-4 shrink-0 text-indigo-400" /> })()}
                {item.label}
              </Link>
            )
          )}
        </nav>
        <div className="border-t border-indigo-800 px-6 py-4">
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}>
            <button type="submit" className="w-full rounded-lg bg-indigo-800 px-3 py-2 text-left text-sm font-medium text-indigo-200 hover:bg-indigo-700 hover:text-white">
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Main — header + profile banner + page content */}
      <div className="flex-1 min-w-0 overflow-auto flex flex-col">
        {!profileStatus.complete && (
          <ProfileBanner
            missingFields={profileStatus.missingFields}
            userId={session.user.id}
            blocking={profileStatus.blocking}
          />
        )}
        <main className="flex-1 px-4 pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+5rem)] md:px-8 md:py-8">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar
        nav={nav}
        userName={session.user.name ?? ''}
        role={role}
        logoutAction={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}
      />
    </div>
  )
}
