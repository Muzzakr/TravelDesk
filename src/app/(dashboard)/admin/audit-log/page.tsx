'use client'

import { useState, useEffect } from 'react'

type LogEntry = {
  id: string
  action: string
  entityType: string
  entityId: string
  ipAddress: string | null
  createdAt: string
  actor: { name: string } | null
}

const PAGE_SIZE = 25

export default function AuditLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/admin/audit-log')
      .then(r => r.ok ? r.json() : [])
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [])

  const totalPages = Math.ceil(logs.length / PAGE_SIZE)
  const pagedLogs = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function exportCSV() {
    const rows = logs.map(l => [
      new Date(l.createdAt).toLocaleString('en-US'),
      l.action, l.entityType, l.entityId,
      l.actor?.name ?? 'System', l.ipAddress ?? '',
    ])
    const header = ['Time', 'Action', 'Entity Type', 'Entity ID', 'Actor', 'IP Address']
    const csv = [header, ...rows].map(r => r.map(v => JSON.stringify(v)).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Audit log</h1>
          <p className="text-sm text-gray-400 mt-0.5">{logs.length} entries · append-only · 7-year retention</p>
        </div>
        <button type="button" onClick={exportCSV}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]">
          Export CSV
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No audit log entries yet.</p>
            ) : pagedLogs.map((log) => (
              <div key={log.id} className="rounded-xl border bg-white px-4 py-3 space-y-1">
                <p className="font-mono text-xs font-medium text-gray-800">{log.action}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{log.entityType} · {log.actor?.name ?? 'System'}</span>
                  <span>{new Date(log.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[700px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Entity type</th>
                  <th className="px-4 py-3 text-left">Entity ID</th>
                  <th className="px-4 py-3 text-left">Actor</th>
                  <th className="px-4 py-3 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">No audit log entries yet.</td>
                  </tr>
                ) : pagedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-800">{log.action}</td>
                    <td className="px-4 py-3 text-gray-500">{log.entityType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.entityId.slice(0, 12)}…</td>
                    <td className="px-4 py-3 text-gray-500">{log.actor?.name ?? 'System'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{log.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-xs text-gray-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, logs.length)} of {logs.length}
              </span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 min-h-[44px]">
                  ← Prev
                </button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 min-h-[44px]">
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
