'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

type Granularity = 'monthly' | 'weekly' | 'daily'

interface DataPoint {
  period: string
  totalUsd: number
}

interface SpendChartProps {
  companyEvents: { id: string; eventName: string }[]
}

const CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'TRANSPORT',     label: 'Transport' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'MEALS',         label: 'Meals' },
  { value: 'SUPPLIES',      label: 'Supplies' },
  { value: 'OTHER',         label: 'Other' },
]

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'daily',   label: 'Daily' },
]

function fmt(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function SpendChart({ companyEvents }: SpendChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('monthly')
  const [eventId,     setEventId]     = useState('')
  const [category,    setCategory]    = useState('')
  const [data,        setData]        = useState<DataPoint[]>([])
  const [budgetUsd,   setBudgetUsd]   = useState<number | null>(null)
  const [loading,     setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ granularity })
    if (eventId)  params.set('eventId', eventId)
    if (category) params.set('category', category)
    const res = await fetch(`/api/finance/spend-over-time?${params}`)
    if (res.ok) {
      const json = await res.json()
      setData(json.data ?? [])
      setBudgetUsd(json.budgetUsd ?? null)
    }
    setLoading(false)
  }, [granularity, eventId, category])

  useEffect(() => { load() }, [load])

  const totalSpend = data.reduce((s, d) => s + d.totalUsd, 0)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Granularity pills */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {GRANULARITIES.map(g => (
            <button
              key={g.value}
              onClick={() => setGranularity(g.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                granularity === g.value
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={eventId}
            onChange={e => setEventId(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">All events</option>
            {companyEvents.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.eventName}</option>
            ))}
          </select>

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      {!loading && data.length > 0 && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            Total: <span className="font-semibold text-gray-900">{fmt(totalSpend)}</span>
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            {data.length} {granularity === 'monthly' ? 'months' : granularity === 'weekly' ? 'weeks' : 'days'}
          </span>
          {budgetUsd && (
            <>
              <span className="text-gray-300">|</span>
              <span className={`font-medium ${totalSpend > budgetUsd ? 'text-red-600' : 'text-green-600'}`}>
                {totalSpend > budgetUsd ? 'Over' : 'Within'} budget ({fmt(budgetUsd)})
              </span>
            </>
          )}
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <svg className="w-6 h-6 animate-spin text-indigo-300" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center rounded-xl border border-dashed border-gray-200">
          <div className="text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm text-gray-400">No approved spend for the selected filters</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip
              formatter={(value: number) => [
                `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                'Spend',
              ]}
              contentStyle={{
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            />
            <Line
              type="monotone"
              dataKey="totalUsd"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 0 }}
            />
            {budgetUsd && (
              <ReferenceLine
                y={budgetUsd}
                stroke="#ef4444"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{ value: `Budget ${fmt(budgetUsd)}`, fontSize: 11, fill: '#ef4444', position: 'insideTopRight' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
