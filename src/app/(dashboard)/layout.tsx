import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Role } from '@/types/user'
import { MobileNav } from '@/components/ui/MobileNav'
import { ProfileBanner } from '@/components/ui/ProfileBanner'
import { getProfileStatus } from '@/lib/profile-check'

type NavItem = { label: string; href: string } | { heading: string }

const navByRole: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { label: 'Dashboard', href: '/employee' },
    { label: 'Travel Requests', href: '/employee/travel-requests' },
    { label: 'Expenses', href: '/employee/expenses' },
    { label: 'My Profile', href: '/employee/profile' },
  ],
  MANAGER: [
    { label: 'Dashboard', href: '/manager' },
    { label: 'Travel Inbox', href: '/manager/inbox' },
    { label: 'Team Spend', href: '/manager/team-spend' },
    { label: 'Teams Travel', href: '/employee/travel-requests' },
  ],
  TRAVEL_AGENT: [
    { label: 'Dashboard', href: '/agent' },
    { label: 'Travel Inbox', href: '/agent/inbox' },
    { label: 'Travel Requests', href: '/agent/bookings' },
    { label: 'Create Travel Booking', href: '/agent/book' },
  ],
  FINANCE_ADMIN: [
    { label: 'Dashboard', href: '/finance' },
    { label: 'Events & Budgets', href: '/finance/events' },
    { label: 'Spend Analytics', href: '/finance/spend-analytics' },
    { label: 'Payout Reports', href: '/finance/payout-reports' },
    { label: 'Policy Limits', href: '/finance/policy' },
    { label: 'Card Transactions', href: '/finance/cards' },
  ],
  SYSTEM_ADMIN: [
    { heading: 'Operations' },
    { label: 'Admin Dashboard',   href: '/admin' },
    { label: 'Travel Requests',   href: '/employee/travel-requests' },
    { label: 'New Travel Request', href: '/employee/travel-requests/new' },
    { label: 'Expenses',          href: '/employee/expenses?view=admin' },
    { label: 'Add Expense',       href: '/employee/expenses?add=1' },
    { label: 'Card Transactions', href: '/finance/cards' },
    { heading: 'Finance' },
    { label: 'Payout Reports',    href: '/finance/payout-reports' },
    { label: 'Spend Analytics',   href: '/finance/spend-analytics' },
    { label: 'Team Spend',        href: '/manager/team-spend' },
    { heading: 'Management' },
    { label: 'Users',             href: '/admin/users' },
    { label: 'Events',            href: '/admin/events' },
    { label: 'Spend Categories',  href: '/admin/spend-categories' },
    { label: 'Policy Limits',     href: '/finance/policy' },
    { label: 'Audit Log',         href: '/admin/audit-log' },
  ],
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const role = session.user.role as Role
  const nav = navByRole[role] ?? navByRole.EMPLOYEE

  // Check profile completeness for roles that travel
  const profileStatus = await getProfileStatus(session.user.id, role)

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile top bar + slide-in nav */}
      <MobileNav
        nav={nav}
        userName={session.user.name ?? ''}
        role={role}
        logoutAction={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}
      />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-indigo-900 text-white">
        <div className="flex h-16 items-center px-6 text-xl font-bold">TravelDesk</div>
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
                className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-indigo-800 ${item.label.startsWith('+') ? 'text-indigo-400 hover:text-indigo-100' : 'text-indigo-100 hover:text-white'}`}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
        <div className="border-t border-indigo-800 px-6 py-4">
          <p className="text-sm font-medium text-white">{session.user.name}</p>
          <p className="text-xs text-indigo-300">{role.replace('_', ' ')}</p>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}>
            <button type="submit" className="mt-3 w-full rounded-lg bg-indigo-800 px-3 py-2 text-left text-sm font-medium text-indigo-200 hover:bg-indigo-700 hover:text-white">
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Main — profile banner + page content */}
      <div className="flex-1 overflow-auto flex flex-col">
        {!profileStatus.complete && (
          <ProfileBanner
            missingFields={profileStatus.missingFields}
            userId={session.user.id}
            blocking={profileStatus.blocking}
          />
        )}
        <main className="flex-1 p-4 pt-18 md:pt-8 md:p-8">{children}</main>
      </div>
    </div>
  )
}
