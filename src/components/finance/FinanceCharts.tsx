'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

type StatusSlice = { status: string; count: number; amount: number }
type CategoryBar = { category: string; amount: number }

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: '#f59e0b',
  UNDER_REVIEW: '#f59e0b',
  APPROVED: '#3b82f6',
  PAID: '#10b981',
  REJECTED: '#ef4444',
  DRAFT: '#94a3b8',
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Pending Manager Review',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Awaiting Payment',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  DRAFT: 'Draft',
}

const CATEGORY_COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#94a3b8']
const CATEGORY_ICONS: Record<string, string> = {
  FLIGHTS: '✈️', FLIGHT: '✈️',
  HOTELS: '🏨', ACCOMMODATION: '🏨',
  MEALS: '🍽️', MEALS_ENTERTAINMENT: '🍽️',
  TRANSPORT: '🚗', TRANSPORTATION: '🚗',
  OTHER: '•', SUPPLIES: '📦',
}

export function FinanceCharts({
  statusDistribution,
  categoryBreakdown,
  onStatusClick,
}: {
  statusDistribution: StatusSlice[]
  categoryBreakdown: CategoryBar[]
  onStatusClick: (status: string) => void
}) {
  const totalCount = statusDistribution.reduce((s, d) => s + d.count, 0)
  const maxCategory = Math.max(...categoryBreakdown.map((c) => c.amount), 1)

  const pieData = statusDistribution.map((d) => ({
    name: STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    amount: d.amount,
    status: d.status,
    color: STATUS_COLORS[d.status] ?? '#94a3b8',
  }))

  return (
    <>
      {/* Expense Status Overview */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Expense status overview</h3>
        {pieData.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">No data</div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    dataKey="value"
                    strokeWidth={0}
                    onClick={(entry: unknown) => {
                      const e = entry as { status?: string }
                      if (e.status) onStatusClick(e.status)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [`${Number(value)} expenses`, String(name)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {pieData.map((entry) => (
                <button
                  type="button"
                  key={entry.status}
                  onClick={() => onStatusClick(entry.status)}
                  className="flex items-center justify-between w-full text-left hover:bg-gray-50 rounded px-1 py-0.5 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-gray-600 truncate">{entry.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-800 ml-2 flex-shrink-0">
                    {entry.value} ({totalCount > 0 ? Math.round((entry.value / totalCount) * 100) : 0}%)
                  </span>
                </button>
              ))}
              <div className="flex items-center justify-between pt-1 border-t">
                <span className="text-xs font-semibold text-gray-700">Total</span>
                <span className="text-xs font-bold text-gray-900">{totalCount}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top spend by category */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">Top spend by category</h3>
        </div>
        {categoryBreakdown.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-gray-400">No data</div>
        ) : (
          <div className="space-y-2.5">
            {categoryBreakdown.slice(0, 5).map((cat, i) => {
              const pct = maxCategory > 0 ? Math.round((cat.amount / maxCategory) * 100) : 0
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-sm w-5 flex-shrink-0">{CATEGORY_ICONS[cat.category.toUpperCase()] ?? '•'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 truncate capitalize">
                        {cat.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-900">
                          ${cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
