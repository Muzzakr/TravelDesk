import Link from 'next/link'
import { DemoForm } from '@/components/landing/DemoForm'

// ── Inline SVG icons ──────────────────────────────────────────────────────────
function IconPlane({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  )
}
function IconCheck({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}
function IconShield({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}
function IconUsers({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}
function IconReceipt({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  )
}
function IconChart({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}
function IconClock({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconLock({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}
function IconArrow({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  )
}


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* ══ NAVBAR ════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/70">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 group-hover:bg-indigo-700 transition-colors flex items-center justify-center text-white">
              <IconPlane className="w-4 h-4" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-gray-900">TravelDesk</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            <a href="#how" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">How it works</a>
            <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Features</a>
            <a href="#security" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">Security</a>
            <a href="#faq" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <a href="#contact" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
              Book a demo
            </a>
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm shadow-indigo-200">
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-[#09090b]">

          {/* Background glow orbs */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
            <div className="absolute top-60 -left-40 w-[400px] h-[400px] rounded-full bg-violet-600/15 blur-[100px]" />
            <div className="absolute top-60 -right-40 w-[400px] h-[400px] rounded-full bg-blue-600/15 blur-[100px]" />
            {/* Dot grid */}
            <div className="absolute inset-0 opacity-[0.15] bg-dot-grid-indigo" />
          </div>

          <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold tracking-widest mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              BUSINESS TRAVEL PLATFORM
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-[72px] font-bold tracking-tight text-white leading-[1.08] max-w-4xl mx-auto">
              Business travel that<br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">actually works</span>
            </h1>

            <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              TravelDesk brings travel requests, bookings, expenses and approvals into one
              seamless flow — from the first request to the final payout.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-900/60 transition-all duration-200"
              >
                Get started
                <IconArrow />
              </Link>
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm border border-white/10 hover:border-white/20 transition-all duration-200"
              >
                Create company account
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-5 text-xs text-gray-500 font-medium">
              {['Role-based access control', 'Encrypted data storage', 'Full audit trail', 'GDPR compliant'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <IconCheck className="w-3.5 h-3.5 text-indigo-500" />
                  {t}
                </span>
              ))}
            </div>

          </div>

          <div aria-hidden className="h-28 bg-gradient-to-b from-transparent to-white" />
        </section>

        {/* ══ STATS BAR ═════════════════════════════════════════════════════════ */}
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              { value: '500+', label: 'Companies using TravelDesk' },
              { value: '12,000+', label: 'Trips managed' },
              { value: '< 2 hrs', label: 'Average approval time' },
            ].map((stat, i) => (
              <div key={stat.label} className={`${i > 0 ? 'sm:border-l border-gray-100' : ''} px-4`}>
                <p className="text-3xl font-bold text-gray-900 tracking-tight">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══ PRODUCT PREVIEW ══════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-3">Product</p>
              <h2 className="text-4xl font-bold text-gray-900">See it in action</h2>
              <p className="mt-3 text-gray-500 max-w-xl mx-auto">A real-time overview of everything that&apos;s happening across your company&apos;s travel.</p>
            </div>

            <div className="rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/80 overflow-hidden">
              {/* Browser chrome */}
              <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-gray-300" />
                  <span className="w-3 h-3 rounded-full bg-gray-300" />
                  <span className="w-3 h-3 rounded-full bg-gray-300" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="w-64 bg-white border border-gray-200 rounded-md px-3 py-1 text-[11px] text-gray-400 font-mono text-center">
                    app.traveldesk.com/admin
                  </div>
                </div>
              </div>

              {/* App layout */}
              <div className="bg-gray-50 flex h-[380px]">
                {/* Sidebar */}
                <div className="w-44 shrink-0 bg-white border-r border-gray-100 px-3 py-5 flex flex-col gap-1">
                  <div className="px-2 pb-3 mb-2 border-b border-gray-100">
                    <span className="text-xs font-bold text-indigo-600 tracking-tight">TravelDesk</span>
                  </div>
                  {[['Dashboard', true], ['Travel Requests', false], ['Events', false], ['Payout Reports', false], ['Users', false], ['Audit Log', false]].map(([label, active]) => (
                    <div key={String(label)} className={`rounded-lg px-3 py-2 text-[11px] font-medium ${active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-400'}`}>
                      {String(label)}
                    </div>
                  ))}
                </div>

                {/* Main */}
                <div className="flex-1 overflow-hidden p-5">
                  <p className="text-sm font-bold text-gray-900 mb-4">Admin Dashboard</p>

                  {/* KPI cards */}
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    {[
                      { label: 'Total Users',    value: '24',    color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100' },
                      { label: 'Open Requests',  value: '7',     color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
                      { label: 'Events',         value: '5',     color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
                      { label: 'Pending Payout', value: '$4 200',color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
                    ].map((k) => (
                      <div key={k.label} className={`rounded-xl border ${k.border} ${k.bg} p-3`}>
                        <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{k.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Mini table */}
                  <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-700">Travel Requests</p>
                    </div>
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Employee', 'Route', 'Event', 'Status'].map((h) => (
                            <th key={h} className="px-4 py-2 text-left text-gray-400 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[
                          { name: 'Anna Karlsson', route: 'Stockholm → London', event: 'Q3 Summit',  status: 'PENDING',  sc: 'bg-amber-100 text-amber-700' },
                          { name: 'Marcus Löf',    route: 'Göteborg → Berlin',  event: 'Sales Conf', status: 'APPROVED', sc: 'bg-green-100 text-green-700' },
                          { name: 'Sofia Berg',    route: 'Malmö → Paris',      event: 'Q3 Summit',  status: 'BOOKED',   sc: 'bg-violet-100 text-violet-700' },
                        ].map((row) => (
                          <tr key={row.name} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2.5 font-medium text-gray-800">{row.name}</td>
                            <td className="px-4 py-2.5 text-gray-500">{row.route}</td>
                            <td className="px-4 py-2.5 text-gray-400">{row.event}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${row.sc}`}>{row.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ ABOUT ═════════════════════════════════════════════════════════════ */}
        <section id="how" className="py-28 px-6 bg-white">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-center">
            <div>
              <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-4">What is TravelDesk?</p>
              <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                A platform for the entire travel process
              </h2>
              <p className="mt-5 text-gray-500 text-lg leading-relaxed">
                From the moment an employee submits a travel request to the point where
                expenses are approved and paid — TravelDesk keeps every step organized,
                trackable and transparent.
              </p>
              <p className="mt-3 text-gray-400 leading-relaxed">
                No more back-and-forth emails. No lost receipts. No unclear approvals.
              </p>
              <Link href="/signup" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors group">
                Get started for free
                <IconArrow className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Travel Requests', desc: 'Structured and trackable', icon: <IconPlane className="w-5 h-5" />, bg: 'bg-indigo-50', ic: 'bg-indigo-100 text-indigo-600', border: 'border-indigo-100' },
                { label: 'Expenses', desc: 'Receipts and cost reports', icon: <IconReceipt className="w-5 h-5" />, bg: 'bg-emerald-50', ic: 'bg-emerald-100 text-emerald-600', border: 'border-emerald-100' },
                { label: 'Approvals', desc: 'Clear flows per role', icon: <IconCheck className="w-5 h-5" />, bg: 'bg-violet-50', ic: 'bg-violet-100 text-violet-600', border: 'border-violet-100' },
                { label: 'Reports', desc: 'Real-time budget control', icon: <IconChart className="w-5 h-5" />, bg: 'bg-amber-50', ic: 'bg-amber-100 text-amber-600', border: 'border-amber-100' },
              ].map((card) => (
                <div key={card.label} className={`p-5 rounded-2xl border ${card.border} ${card.bg} hover:scale-[1.02] transition-transform duration-200 shadow-sm`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.ic}`}>
                    {card.icon}
                  </div>
                  <p className="text-sm font-bold text-gray-900">{card.label}</p>
                  <p className="mt-1 text-xs text-gray-500">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ══════════════════════════════════════════════════════ */}
        <section className="py-28 px-6 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-3">How it works</p>
              <h2 className="text-4xl font-bold text-gray-900">Four simple steps</h2>
              <p className="mt-3 text-gray-500 max-w-xl mx-auto">
                From request to payout — the entire flow is automated.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8 relative">
              <div aria-hidden className="hidden md:block absolute top-8 left-[calc(12.5%+2rem)] right-[calc(12.5%+2rem)] border-t-2 border-dashed border-indigo-200" />
              {[
                { n: 1, title: 'Submit request', desc: 'The employee fills in destination, dates and required services.' },
                { n: 2, title: 'Travel agent', desc: 'The agent receives the request and presents booking options.' },
                { n: 3, title: 'Manager approves', desc: 'The manager reviews and approves the trip with one click.' },
                { n: 4, title: 'Payout', desc: 'Finance generates the payout report automatically.' },
              ].map((s) => (
                <div key={s.n} className="flex flex-col items-center text-center relative">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold mb-5 shadow-lg shadow-indigo-200 relative z-10">
                    {s.n}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FEATURES ══════════════════════════════════════════════════════════ */}
        <section id="features" className="py-28 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-3">Features</p>
              <h2 className="text-4xl font-bold text-gray-900">Everything in one place</h2>
              <p className="mt-3 text-gray-500 max-w-xl mx-auto">
                TravelDesk gives every role exactly what they need — nothing more, nothing less.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: <IconPlane className="w-5 h-5" />, title: 'Travel Requests', desc: 'Structured forms with all information in one place — destination, dates, services and budget in a single flow.' },
                { icon: <IconCheck className="w-5 h-5" />, title: 'Approval Flow', desc: 'Automatic routing via manager and travel agent. The right person is notified without manual coordination.' },
                { icon: <IconReceipt className="w-5 h-5" />, title: 'Expense Management', desc: 'Upload receipts with OCR parsing, categorize and submit for approval directly in the platform.' },
                { icon: <IconClock className="w-5 h-5" />, title: 'Booking Management', desc: 'Travel agents book flights, hotels and car rentals, all linked to the correct event and budget.' },
                { icon: <IconChart className="w-5 h-5" />, title: 'Cost Control', desc: 'Per-event budgets, weekly payout reports and a real-time overview for Finance admins.' },
                { icon: <IconShield className="w-5 h-5" />, title: 'Audit Log', desc: 'Every action is permanently logged. Full traceability for compliance and internal auditing.' },
              ].map((f) => (
                <div key={f.title} className="group p-7 rounded-2xl border border-gray-100 hover:border-indigo-200 bg-white hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5 transition-colors">
                    {f.icon}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ ROLES ═════════════════════════════════════════════════════════════ */}
        <section className="py-28 px-6 bg-[#09090b] bg-dot-grid bg-hero-glow relative overflow-hidden">
          <div className="relative max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white">Built for the whole team</h2>
              <p className="mt-4 text-gray-400 max-w-xl mx-auto">
                Every role has its own dashboard and exactly the tools they need.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { role: 'Employee', desc: 'Submits trips & expenses', icon: <IconUsers className="w-5 h-5" /> },
                { role: 'Manager', desc: 'Approves & delegates', icon: <IconCheck className="w-5 h-5" /> },
                { role: 'Travel Agent', desc: 'Books & arranges', icon: <IconPlane className="w-5 h-5" /> },
                { role: 'Finance', desc: 'Pays out & reports', icon: <IconChart className="w-5 h-5" /> },
                { role: 'Admin', desc: 'Manages accounts & policy', icon: <IconShield className="w-5 h-5" /> },
              ].map((r) => (
                <div key={r.role} className="group p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-500/30 text-center transition-all duration-200">
                  <div className="w-10 h-10 rounded-xl bg-white/10 group-hover:bg-indigo-500/20 text-gray-400 group-hover:text-indigo-400 flex items-center justify-center mx-auto mb-4 transition-colors">
                    {r.icon}
                  </div>
                  <p className="text-sm font-bold text-white">{r.role}</p>
                  <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ TESTIMONIALS ══════════════════════════════════════════════════════ */}
        <section className="py-28 px-6 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-3">What our customers say</p>
              <h2 className="text-4xl font-bold text-gray-900">Trusted by travel managers</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  quote: 'Saved us 4 hours per week in approval back-and-forth. Our managers can approve from their phones in seconds.',
                  name: 'Anna K.', role: 'HR Manager', company: 'Nordea Group',
                  initials: 'AK', color: 'bg-indigo-600',
                },
                {
                  quote: 'We used to track everything in spreadsheets. TravelDesk replaced that entirely — receipts, budgets, payout reports, all in one place.',
                  name: 'Marcus L.', role: 'Finance Director', company: 'Kinnevik',
                  initials: 'ML', color: 'bg-violet-600',
                },
                {
                  quote: 'The audit log alone was worth it. Our compliance team loves having a full trail of every approval decision.',
                  name: 'Sofia B.', role: 'Compliance Lead', company: 'SEB',
                  initials: 'SB', color: 'bg-emerald-600',
                },
              ].map((t) => (
                <div key={t.name} className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 mb-5">
                    {[0,1,2,3,4].map((i) => (
                      <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${t.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.role} · {t.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ SECURITY ══════════════════════════════════════════════════════════ */}
        <section id="security" className="py-28 px-6 bg-white">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-start">
            <div>
              <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-4">Security</p>
              <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                Your data is safe with us
              </h2>
              <p className="mt-5 text-gray-500 text-lg leading-relaxed">
                TravelDesk is built with security as a priority — not an afterthought.
                Every login, every file and every data point is protected with industry standards.
              </p>

              <ul className="mt-10 space-y-5">
                {[
                  { icon: <IconLock className="w-5 h-5" />, title: 'Secure authentication', desc: 'Passwords hashed with bcrypt. MFA support for an extra layer of protection.' },
                  { icon: <IconUsers className="w-5 h-5" />, title: 'Role-based access control', desc: 'Every user sees exactly and only what they are authorized to see.' },
                  { icon: <IconShield className="w-5 h-5" />, title: 'Immutable audit log', desc: 'All events are logged permanently — deleted records cannot be undone.' },
                  { icon: <IconChart className="w-5 h-5" />, title: 'Company isolation', desc: 'Every company\'s data is completely isolated. No data leakage between accounts.' },
                ].map((item) => (
                  <li key={item.title} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center text-indigo-600 flex-shrink-0 mt-0.5">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-[#09090b] border border-white/10 p-8">
              <p className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-6">Tech stack</p>
              <div className="space-y-4">
                {[
                  { label: 'Password hashing', value: 'bcrypt (cost factor 12)', badge: 'bg-green-500/10 text-green-400 border-green-500/20' },
                  { label: 'Session tokens', value: 'Signed JWT', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
                  { label: 'Authentication', value: 'NextAuth v5', badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
                  { label: 'Database', value: 'PostgreSQL (Supabase)', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                  { label: 'File storage', value: 'AWS S3 (AES-256)', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  { label: 'Access control', value: 'RBAC (5 roles)', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <span className="text-sm text-gray-400">{item.label}</span>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${item.badge}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ FAQ ═══════════════════════════════════════════════════════════════ */}
        <section id="faq" className="py-28 px-6 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-3">FAQ</p>
              <h2 className="text-4xl font-bold text-gray-900">Common questions</h2>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: 'Can multiple managers approve a travel request?',
                  a: 'Yes. TravelDesk supports a hierarchical approval flow — a request can be routed through both a direct manager and a travel agent before being confirmed. Each step is logged in the audit trail.',
                },
                {
                  q: 'How does TravelDesk handle GDPR?',
                  a: 'All data is stored on EU-based servers and isolated per company. Employees can request data exports at any time. No personal data is shared between companies or used for training.',
                },
                {
                  q: 'Can we try it for free?',
                  a: 'Yes. Create a company account and invite your team — no credit card required. During the beta period, all features are available at no cost.',
                },
                {
                  q: 'What happens if an expense is missing a receipt?',
                  a: 'The system flags the expense in red on the admin dashboard. The expense cannot be included in a payout report until a receipt is uploaded.',
                },
                {
                  q: 'Which roles are included in TravelDesk?',
                  a: 'Five roles: Employee (submits requests and expenses), Manager (approves trips), Travel Agent (books and arranges travel), Finance Admin (handles payouts and reports), and System Admin (manages users and policy).',
                },
                {
                  q: 'Does TravelDesk integrate with our existing tools?',
                  a: 'TravelDesk supports webhook integrations so you can connect to Slack, HR systems or custom internal tools. Native integrations with major tools are on the roadmap.',
                },
              ].map((item) => (
                <details key={item.q} className="group rounded-xl border border-gray-100 bg-white px-6 py-4 hover:border-indigo-200 transition-colors cursor-pointer">
                  <summary className="flex items-center justify-between gap-4 text-sm font-semibold text-gray-900 list-none select-none">
                    {item.q}
                    <span className="shrink-0 w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 group-open:rotate-45 transition-transform duration-200 text-xs font-bold">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-gray-500 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FINAL CTA ═════════════════════════════════════════════════════════ */}
        <section className="py-28 px-6 bg-[#09090b] bg-dot-grid bg-hero-glow relative overflow-hidden">
          <div className="relative max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight">
              Ready to take control of<br />
              <span className="text-indigo-400">your business travel?</span>
            </h2>
            <p className="mt-5 text-lg text-gray-400 leading-relaxed">
              Get started in minutes. No long contracts, no complicated onboarding.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base shadow-xl shadow-indigo-900/50 transition-all duration-200"
              >
                Log in
                <IconArrow />
              </Link>
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-base border border-white/10 hover:border-white/20 transition-all duration-200"
              >
                Create account for free
              </Link>
            </div>
          </div>
        </section>

        {/* ══ CONTACT / BOOK A DEMO ═════════════════════════════════════════════ */}
        <section id="contact" className="py-28 px-6 bg-white">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase mb-3">Book a demo</p>
              <h2 className="text-4xl font-bold text-gray-900">See it in action</h2>
              <p className="mt-4 text-gray-500 text-lg leading-relaxed">
                Tell us a little about your team and we&apos;ll set up a walkthrough tailored to you.
              </p>
            </div>
            <DemoForm />
          </div>
        </section>
      </main>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer className="bg-gray-950 border-t border-white/5 text-gray-500 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white">
              <IconPlane className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-semibold text-gray-400">TravelDesk</span>
          </div>
          <p className="text-xs text-gray-600 order-last md:order-none">
            &copy; {new Date().getFullYear()} TravelDesk. All rights reserved.
          </p>
          <nav className="flex gap-6">
            <Link href="/login" className="text-xs hover:text-gray-300 transition-colors">Log in</Link>
            <Link href="/signup" className="text-xs hover:text-gray-300 transition-colors">Create account</Link>
            <Link href="/unsubscribe" className="text-xs hover:text-gray-300 transition-colors">Unsubscribe</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
