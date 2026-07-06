'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type ReportExpense = {
  id: string
  amountUsd: number
  category: string
  description: string
  merchantName: string | null
  transactionDate: string | null
  employee: { name: string }
  event: { eventName: string; eventCode: string }
}

type Report = {
  id: string
  periodStart: string
  periodEnd: string
  status: string
  totalUsd: number
  generatedAt: string
  paidAt: string | null
  expenses: ReportExpense[]
}

export default function PayoutReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/payout-reports')
    if (res.ok) setReports(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function generate() {
    setGenerating(true)
    setError('')
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((day + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    const res = await fetch('/api/payout-reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStart: monday.toISOString(), periodEnd: sunday.toISOString() }),
    })
    if (res.ok) {
      load()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to generate report')
    }
    setGenerating(false)
  }

  async function markPaid(id: string) {
    setMarkingId(id)
    const res = await fetch('/api/payout-reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: id }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to mark as paid')
    }
    setMarkingId(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payout reports</h1>
        <Button onClick={generate} loading={generating}>Generate this week</Button>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          No payout reports yet. Click &quot;Generate this week&quot; to create one.
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border bg-white px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-900 text-sm">
                    {new Date(r.periodStart).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} – {new Date(r.periodEnd).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                  </p>
                  <Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="text-xl font-bold text-gray-900">${Number(r.totalUsd).toFixed(2)}</p>
                <p className="text-xs text-gray-400">Generated {new Date(r.generatedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
                {r.paidAt && <p className="text-xs text-green-600">Paid {new Date(r.paidAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>}
                {r.expenses.length > 0 && (
                  <div className="pt-1 space-y-1">
                    {r.expenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-xs text-gray-600">
                        <span>{e.employee.name} · {e.category.replace(/_/g, ' ')}</span>
                        <span className="font-medium">${Number(e.amountUsd).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 pt-1">
                  {r.status !== 'PAID' && r.status !== 'EXPORTED' ? (
                    <button
                      type="button"
                      onClick={() => markPaid(r.id)}
                      disabled={markingId === r.id}
                      className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50"
                    >
                      {markingId === r.id ? 'Saving…' : 'Mark as paid'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Immutable</span>
                  )}
                  <a href={`/api/finance/export?reportId=${r.id}`} download className="text-xs font-medium text-indigo-600 hover:underline">
                    Export CSV
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Period</th>
                  <th className="px-4 py-3 text-left">Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Generated</th>
                  <th className="px-4 py-3 text-left">Paid at</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {new Date(r.periodStart).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} – {new Date(r.periodEnd).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">${Number(r.totalUsd).toFixed(2)}</td>
                      <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-4 py-3 text-gray-400">{new Date(r.generatedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                      <td className="px-4 py-3 text-gray-400">{r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {r.status !== 'PAID' && r.status !== 'EXPORTED' ? (
                            <button
                              type="button"
                              onClick={() => markPaid(r.id)}
                              disabled={markingId === r.id}
                              className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50"
                            >
                              {markingId === r.id ? 'Saving…' : 'Mark as paid'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">Immutable</span>
                          )}
                          <a href={`/api/finance/export?reportId=${r.id}`} download className="text-xs font-medium text-indigo-600 hover:underline">
                            Export CSV
                          </a>
                        </div>
                      </td>
                    </tr>
                    {r.expenses.map((e) => (
                      <tr key={e.id} className="bg-gray-50/60 border-t border-gray-100">
                        <td colSpan={6} className="pl-8 pr-4 py-2.5">
                          <div className="flex items-center gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-gray-700 truncate" title={e.event.eventName}>
                                <span className="font-mono text-gray-400 mr-1.5">{e.event.eventCode}</span>
                                {e.event.eventName}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                                {e.employee.name}
                                {e.merchantName ? ` · ${e.merchantName}` : ''}
                                {e.transactionDate ? ` · ${new Date(e.transactionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-500">
                              {e.category.replace(/_/g, ' ')}
                            </span>
                            <span className="shrink-0 w-20 text-right text-xs font-semibold text-gray-800">
                              ${Number(e.amountUsd).toFixed(2)}
                            </span>
                            <Link href={`/manager/approvals/expense/${e.id}`}
                              className="shrink-0 text-xs font-medium text-indigo-600 hover:underline whitespace-nowrap">
                              View receipt
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
