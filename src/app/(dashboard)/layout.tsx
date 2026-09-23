import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { Role } from '@/types/user'
import { MobileNav } from '@/components/ui/MobileNav'
import { Sidebar } from '@/components/ui/Sidebar'
import { BottomTabBar } from '@/components/ui/BottomTabBar'
import { ProfileBanner } from '@/components/ui/ProfileBanner'
import { getProfileStatus } from '@/lib/profile-check'
import { prisma } from '@/lib/prisma'

type NavItem = { label: string; href: string } | { heading: string }

const SECURITY_LINK = { label: 'Security', href: '/settings/security' }
const NOTIFICATIONS_LINK = { label: 'Notifications', href: '/settings/notifications' }

const navByRole: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { label: 'Dashboard', href: '/employee' },
    { label: 'Travel Requests', href: '/employee/travel-requests' },
    { label: 'Expenses', href: '/employee/expenses' },
    { label: 'My Profile', href: '/employee/profile' },
    NOTIFICATIONS_LINK,
    SECURITY_LINK,
  ],
  MANAGER: [
    { label: 'Dashboard', href: '/manager' },
    { heading: 'My Work' },
    { label: 'Travel Inbox', href: '/manager/inbox' },
    { label: 'Team Travel', href: '/manager/team-travel' },
    { heading: 'Finance' },
    { label: 'All Expenses', href: '/finance/expenses' },
    { label: 'Payouts', href: '/finance/payout-reports' },
    { label: 'Card Transactions', href: '/finance/cards' },
    { label: 'Finance Reports', href: '/finance/reports' },
    { label: 'Statistics', href: '/admin/stats' },
    { heading: 'Administration' },
    { label: 'Employee', href: '/manager/users-roles' },
    { label: 'Workflows', href: '/manager/workflows' },
    { label: 'Monthly Reports', href: '/manager/reports' },
    NOTIFICATIONS_LINK,
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
    { label: 'Payouts', href: '/finance/payout-reports' },
    { label: 'Statistics', href: '/admin/stats' },
    { heading: 'Administration' },
    { label: 'Employees', href: '/manager/users-roles' },
    NOTIFICATIONS_LINK,
    SECURITY_LINK,
  ],
  TRAVEL_AGENT: [
    { label: 'Dashboard', href: '/agent' },
    { label: 'Travel Inbox', href: '/agent/inbox' },
    { label: 'Travel Requests', href: '/agent/bookings' },
    { label: 'Create Travel Booking', href: '/agent/book' },
    NOTIFICATIONS_LINK,
    SECURITY_LINK,
  ],
  FINANCE_ADMIN: [
    { label: 'Dashboard', href: '/finance' },
    { label: 'Expenses', href: '/finance/expenses' },
    { label: 'Payouts', href: '/finance/payout-reports' },
    { label: 'Monthly Reports', href: '/finance/reports' },
    { heading: 'Settings' },
    { label: 'Events & Budgets', href: '/finance/events' },
    { label: 'Policy Limits', href: '/finance/policy' },
    { label: 'Card Transactions', href: '/finance/cards' },
    NOTIFICATIONS_LINK,
    SECURITY_LINK,
  ],
  SYSTEM_ADMIN: [
    { heading: 'Operations' },
    { label: 'Admin Dashboard',   href: '/admin' },
    { label: 'Travel Inbox',      href: '/manager/inbox' },
    { label: 'Travel Requests',   href: '/admin/travel-requests' },
    { label: 'Open Requests',     href: '/manager/requests/unassigned' },
    { label: 'Expenses',          href: '/admin/expenses' },
    { heading: 'Finance' },
    { label: 'Payouts',           href: '/finance/payout-reports' },
    { label: 'Statistics',        href: '/admin/stats' },
    { heading: 'Management' },
    { label: 'Users',             href: '/admin/users' },
    { label: 'Events',            href: '/admin/events' },
    { label: 'Policy Limits',     href: '/finance/policy' },
    { label: 'Audit Log',         href: '/admin/audit-log' },
    { label: 'Email Notifications', href: '/admin/emails' },
    { label: 'Settings',          href: '/admin/settings' },
    NOTIFICATIONS_LINK,
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

  // Fetch company branding (only if companyId present)
  let logoUrl: string | null = null
  let companyName = 'M4U Travel'
  if (session.user.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { logoUrl: true, name: true },
    })
    logoUrl = company?.logoUrl ?? null
    companyName = company?.name || companyName
  }

  // Sidebar badge counts — only computed for the glass Travel Manager sidebar,
  // so the other 5 roles never pay for these extra queries on every page render.
  let badgeCounts: Record<string, number> | undefined
  if (role === 'TRAVEL_MANAGER' && session.user.companyId) {
    const companyId = session.user.companyId
    const [travelPending, expensePending, inactiveEmployees] = await Promise.all([
      prisma.travelRequest.count({ where: { companyId, status: 'PENDING_MANAGER' } }),
      prisma.expense.count({ where: { companyId, status: 'SUBMITTED' } }),
      prisma.user.count({ where: { companyId, role: 'EMPLOYEE', isActive: false } }),
    ])
    badgeCounts = {
      '/manager/team-travel': travelPending,
      '/finance/expenses': expensePending,
      '/manager/users-roles': inactiveEmployees,
    }
  }

  const sidebarVariant = role === 'TRAVEL_MANAGER' ? 'glass' : 'solid'

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Mobile top bar (primary nav is the bottom tab bar) */}
      <MobileNav name={companyName} logoUrl={logoUrl} variant={sidebarVariant} />

      {/* Desktop sidebar */}
      <Sidebar
        variant={sidebarVariant}
        nav={nav}
        companyName={companyName}
        logoUrl={logoUrl}
        userName={session.user.name ?? ''}
        role={role}
        badgeCounts={badgeCounts}
        logoutAction={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}
      />

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
