'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'

type MonthlyPoint = { month: string; travel: number; expense: number }
type PieSlice = { name: string; value: number; color: string }

export function SpendCharts({
  monthlyData,
  pieData,
}: {
  monthlyData: MonthlyPoint[]
  pieData: PieSlice[]
}) {
  const total = pieData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Line chart — takes 3/5 width */}
      <div className="lg:col-span-3 rounded-xl bg-white border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Spend Overview (This Month)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => `$${Number(v).toLocaleString('en-US')}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="travel" name="Travel Spend" stroke="#6366f1" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="expense" name="Expense Spend" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Donut chart — takes 2/5 width */}
      <div className="lg:col-span-2 rounded-xl bg-white border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Spend by Category (This Month)</h2>
        {pieData.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">No data</div>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-gray-600 truncate">{entry.name}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-900 flex-shrink-0">
                    ${entry.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    {total > 0 && (
                      <span className="text-gray-400 ml-1">({Math.round((entry.value / total) * 100)}%)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
