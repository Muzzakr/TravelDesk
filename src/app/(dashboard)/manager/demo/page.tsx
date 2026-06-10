import Link from 'next/link'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

const DEMO_TRAVEL = [
  { id: '1', employee: 'Priya Sharma',   origin: 'Stockholm',  destination: 'New York, NY', event: 'Annual Sales Kickoff', status: 'PENDING_MANAGER', date: '2026-06-08' },
  { id: '2', employee: 'Rohit Mehta',    origin: 'London, UK', destination: 'Paris, FR',    event: 'Client Summit',       status: 'PENDING_AGENT',   date: '2026-06-07' },
  { id: '3', employee: 'Amit Patel',     origin: 'Dubai, UAE', destination: 'Singapore',    event: 'APAC Conference',     status: 'BOOKING_CONFIRMED', date: '2026-06-05' },
  { id: '4', employee: 'Neha Gupta',     origin: 'Mumbai',     destination: 'Bangalore',    event: 'Team Offsite',        status: 'APPROVED',        date: '2026-06-04' },
  { id: '5', employee: 'Deepak Singh',   origin: 'Stockholm',  destination: 'Berlin, DE',   event: 'Product Launch',      status: 'PENDING_MANAGER', date: '2026-06-03' },
]

const DEMO_EXPENSES = [
  { id: '1', employee: 'Rohit Mehta',  description: 'Taxi to Airport',  category: 'TRANSPORT',     amount: 45.50,  status: 'SUBMITTED', date: '2026-06-08' },
  { id: '2', employee: 'Priya Sharma', description: 'Team Lunch',        category: 'MEALS',         amount: 85.75,  status: 'SUBMITTED', date: '2026-06-07' },
  { id: '3', employee: 'Amit Patel',   description: 'Hotel Stay',        category: 'ACCOMMODATION', amount: 320.00, status: 'APPROVED',  date: '2026-06-06' },
  { id: '4', employee: 'Neha Gupta',   description: 'Flight to Mumbai',  category: 'TRANSPORT',     amount: 580.00, status: 'APPROVED',  date: '2026-06-05' },
  { id: '5', employee: 'Deepak Singh', description: 'Client Dinner',     category: 'MEALS',         amount: 210.00, status: 'SUBMITTED', date: '2026-06-04' },
]

export default function ManagerDashboardDemo() {
  const now = new Date()
  const travelPending = DEMO_TRAVEL.filter(r => r.status === 'PENDING_MANAGER').length
  const expensePending = DEMO_EXPENSES.filter(e => e.status === 'SUBMITTED').length
  const travelTotal = DEMO_TRAVEL.length
  const expenseTotal = DEMO_EXPENSES.length
  const travelRejected = 1
  const travelApprovedMonth = 4
  const expenseApprovedMonth = 2
  const teamCount = 24
  const activeTeamCount = 22
  const totalSpendAmount = DEMO_EXPENSES.filter(e => e.status === 'APPROVED').reduce((s, e) => s + e.amount, 0)

  const urgentItems = [
    { count: travelPending, label: 'Travel requests pending', href: '/manager/approvals', color: 'amber' as const },
    { count: expensePending, label: 'Expenses pending review', href: '/manager/team-expenses', color: 'orange' as const },
  ]

  const urgentColors = {
    amber:  { border: 'border-amber-300',  bg: 'bg-amber-50',  text: 'text-amber-600',  sub: 'text-amber-700' },
    orange: { border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-600', sub: 'text-orange-700' },
  }

  const kpis = [
    { label: 'Team Members',        value: teamCount,           sub: `${activeTeamCount} active`,  href: '/manager/users-roles',   urgent: false },
    { label: 'Open Requests',       value: travelPending,       sub: 'need review',                href: '/manager/approvals',     urgent: true },
    { label: 'Pending Expenses',    value: expensePending,      sub: 'need review',                href: '/manager/team-expenses', urgent: true },
    { label: 'Approved This Month', value: travelApprovedMonth, sub: 'travel requests',            href: '/manager/team-travel',   urgent: false },
    { label: 'Spend This Month',    value: `$${totalSpendAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: 'approved expenses', href: '/manager/reports', urgent: false },
  ]

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Demo banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
        <span className="text-blue-600 text-lg">🎨</span>
        <p className="text-sm text-blue-700 font-medium">Demo view — showing sample data. <Link href="/manager" className="underline">Go to live dashboard →</Link></p>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">2 items require attention</p>
        </div>
        <span className="text-xs text-gray-400 mt-1.5">
          {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Needs Attention */}
      <section>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Needs attention</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {urgentItems.map((item) => {
            const c = urgentColors[item.color]
            return (
              <div key={item.label} className={`rounded-xl border-2 ${c.border} ${c.bg} px-5 py-4 flex items-center justify-between`}>
                <div>
                  <p className={`text-3xl font-bold ${c.text}`}>{item.count}</p>
                  <p className={`text-sm font-medium ${c.sub} mt-0.5`}>{item.label}</p>
                </div>
                <span className={`${c.text} opacity-50`}><ChevronRight /></span>
              </div>
            )
          })}
        </div>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-xl border bg-white px-5 py-4 ${k.urgent ? 'border-amber-300 bg-amber-50' : 'border-gray-100'}`}>
            <p className={`text-2xl font-bold ${k.urgent ? 'text-amber-600' : 'text-gray-900'}`}>{k.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{k.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Travel Requests */}
        <details open className="group rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 text-sm font-bold">✈</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Travel Requests</p>
                <p className="text-xs text-gray-400">{travelTotal} total · {travelPending} pending review</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5">{travelPending}</span>
              <svg className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </summary>

          <div className="px-5 pb-3 grid grid-cols-3 gap-3 border-t border-gray-50 pt-3">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{travelTotal}</p>
              <p className="text-[11px] text-gray-400">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-600">{travelPending}</p>
              <p className="text-[11px] text-gray-400">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-500">{travelRejected}</p>
              <p className="text-[11px] text-gray-400">Rejected</p>
            </div>
          </div>

          <div className="border-t border-gray-50 divide-y divide-gray-50">
            {DEMO_TRAVEL.map((r) => (
              <div key={r.id} className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{r.employee}</p>
                  <p className="text-[11px] text-gray-400 truncate">{r.origin} → {r.destination}</p>
                </div>
                <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
            <Link href="/manager/team-travel" className="text-xs font-semibold text-indigo-600 hover:underline">View all →</Link>
            <Link href="/manager/approvals" className="text-xs text-gray-500 hover:underline">Pending approvals</Link>
          </div>
        </details>

        {/* Team Expenses */}
        <details open className="group rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 text-sm font-bold">💳</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Team Expenses</p>
                <p className="text-xs text-gray-400">{expenseTotal} total · {expensePending} pending review</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5">{expensePending}</span>
              <svg className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </summary>

          <div className="px-5 pb-3 grid grid-cols-3 gap-3 border-t border-gray-50 pt-3">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{expenseTotal}</p>
              <p className="text-[11px] text-gray-400">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-orange-600">{expensePending}</p>
              <p className="text-[11px] text-gray-400">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{expenseApprovedMonth}</p>
              <p className="text-[11px] text-gray-400">Approved</p>
            </div>
          </div>

          <div className="border-t border-gray-50 divide-y divide-gray-50">
            {DEMO_EXPENSES.map((e) => (
              <div key={e.id} className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{e.employee}</p>
                  <p className="text-[11px] text-gray-400 truncate">{e.category.replace(/_/g, ' ')} · {e.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-gray-700">${e.amount.toFixed(2)}</span>
                  <Badge variant={statusToBadgeVariant(e.status)}>{e.status.replace(/_/g, ' ')}</Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
            <Link href="/manager/team-expenses" className="text-xs font-semibold text-indigo-600 hover:underline">View all →</Link>
            <Link href="/manager/approvals" className="text-xs text-gray-500 hover:underline">Pending approvals</Link>
          </div>
        </details>

      </div>
    </div>
  )
}
