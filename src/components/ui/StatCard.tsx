import Link from 'next/link'

type StatColor = 'neutral' | 'amber' | 'red' | 'orange' | 'green' | 'blue' | 'indigo' | 'purple'

interface StatCardProps {
  label: string
  value: string | number
  sublabel?: string
  color?: StatColor
  /** Renders the larger, tinted "needs attention" treatment instead of a plain KPI tile. */
  urgent?: boolean
  href?: string
  onClick?: () => void
}

const COLOR_CLASSES: Record<StatColor, { text: string; border: string; bg: string; sub: string }> = {
  neutral: { text: 'text-gray-900', border: 'border-gray-100', bg: 'bg-white', sub: 'text-gray-400' },
  amber:   { text: 'text-amber-600',  border: 'border-amber-300',  bg: 'bg-amber-50',  sub: 'text-amber-700' },
  red:     { text: 'text-red-600',    border: 'border-red-300',    bg: 'bg-red-50',    sub: 'text-red-700' },
  orange:  { text: 'text-orange-600', border: 'border-orange-300', bg: 'bg-orange-50', sub: 'text-orange-700' },
  green:   { text: 'text-green-600',  border: 'border-green-300',  bg: 'bg-green-50',  sub: 'text-green-700' },
  blue:    { text: 'text-blue-600',   border: 'border-blue-300',   bg: 'bg-blue-50',   sub: 'text-blue-700' },
  indigo:  { text: 'text-indigo-600', border: 'border-indigo-300', bg: 'bg-indigo-50', sub: 'text-indigo-700' },
  purple:  { text: 'text-purple-600', border: 'border-purple-300', bg: 'bg-purple-50', sub: 'text-purple-700' },
}

const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

/**
 * Shared stat tile for the employer-side dashboards (Admin/Manager/Finance).
 * Replaces what used to be independently hand-copied KPI-card and
 * "needs attention" card markup on /admin and /manager.
 */
export function StatCard({ label, value, sublabel, color = 'neutral', urgent = false, href, onClick }: StatCardProps) {
  const c = COLOR_CLASSES[urgent && color === 'neutral' ? 'amber' : color]

  const content = urgent ? (
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-3xl font-bold ${c.text}`}>{value}</p>
        <p className={`text-sm font-medium ${c.sub} mt-0.5`}>{label}</p>
      </div>
      <span className={`${c.text} opacity-50 group-hover:opacity-100 transition-opacity`}><ChevronRight /></span>
    </div>
  ) : (
    <>
      <p className={`text-2xl font-bold truncate ${c.text}`}>{value}</p>
      <p className="text-xs font-semibold text-gray-700 mt-0.5">{label}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </>
  )

  const className = urgent
    ? `rounded-xl border-2 ${c.border} ${c.bg} px-5 py-4 hover:shadow-md transition-all group`
    : `rounded-xl border bg-white px-4 py-3 transition-all group ${(href || onClick) ? 'hover:shadow-md' : ''} ${color !== 'neutral' ? `${c.border} ${c.bg}` : 'border-gray-100'}`

  if (href) return <Link href={href} className={className}>{content}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={`${className} text-left w-full`}>{content}</button>
  return <div className={className}>{content}</div>
}
