'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Modal } from '@/components/ui/Modal'
import { EMAIL_TYPE_GROUPS, ALL_EMAIL_TYPES, emailTypeLabel } from '@/lib/email-types'

type EmailStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'

type EmailLogRow = {
  id: string
  type: string
  to: string[]
  subject: string
  status: EmailStatus
  attempts: number
  errorMessage: string | null
  relatedEntityType: string | null
  relatedEntityId: string | null
  createdAt: string
  sentAt: string | null
}

type SettingGroup = { group: string; types: { type: string; label: string; enabled: boolean }[] }

const statusVariant: Record<EmailStatus, 'gray' | 'blue' | 'green' | 'yellow' | 'red'> = {
  PENDING: 'yellow',
  SENT: 'green',
  FAILED: 'red',
  SKIPPED: 'gray',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminEmailsPage() {
  const [tab, setTab] = useState<'log' | 'settings'>('log')

  // Log state
  const [logs, setLogs] = useState<EmailLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<EmailLogRow | null>(null)
  const [retrying, setRetrying] = useState(false)

  // Settings state
  const [settings, setSettings] = useState<SettingGroup[] | null>(null)
  const [savingType, setSavingType] = useState<string | null>(null)

  // Preview state
  const [previewType, setPreviewType] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeRole, setComposeRole] = useState('')
  const [composeSending, setComposeSending] = useState(false)
  const [composeResult, setComposeResult] = useState<string | null>(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (type) params.set('type', type)
    if (search) params.set('search', search)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await fetch(`/api/admin/email-log?${params.toString()}`)
    if (res.ok) setLogs(await res.json())
    setLoading(false)
  }, [status, type, search, from, to])

  useEffect(() => { loadLogs() }, [loadLogs])

  useEffect(() => {
    if (tab === 'settings' && !settings) {
      fetch('/api/admin/email-settings').then((r) => r.json()).then(setSettings)
    }
  }, [tab, settings])

  async function retry() {
    if (!selected) return
    setRetrying(true)
    const res = await fetch(`/api/admin/email-log/${selected.id}/retry`, { method: 'POST' })
    if (res.ok) {
      await loadLogs()
      const fresh = await fetch(`/api/admin/email-log/${selected.id}`).then((r) => r.json())
      setSelected(fresh)
    }
    setRetrying(false)
  }

  async function toggleSetting(t: string, enabled: boolean) {
    setSavingType(t)
    const res = await fetch('/api/admin/email-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: t, enabled }),
    })
    if (res.ok && settings) {
      setSettings(settings.map((g) => ({ ...g, types: g.types.map((x) => x.type === t ? { ...x, enabled } : x) })))
    }
    setSavingType(null)
  }

  async function openPreview(t: string) {
    setPreviewType(t)
    setPreviewHtml(null)
    setPreviewLoading(true)
    const res = await fetch(`/api/admin/email-log/preview?type=${encodeURIComponent(t)}`)
    if (res.ok) {
      const data = await res.json()
      setPreviewHtml(data.html)
    }
    setPreviewLoading(false)
  }

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault()
    setComposeSending(true)
    setComposeResult(null)
    const res = await fetch('/api/admin/email-log/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: composeSubject, body: composeBody, role: composeRole || undefined }),
    })
    if (res.ok) {
      const data = await res.json()
      setComposeResult(`Sent to ${data.recipientCount} recipient${data.recipientCount !== 1 ? 's' : ''}.`)
      setComposeSubject(''); setComposeBody(''); setComposeRole('')
      loadLogs()
    } else {
      setComposeResult('Failed to send announcement.')
    }
    setComposeSending(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Email notifications</h1>
        <Button onClick={() => setComposeOpen(true)}>+ Compose announcement</Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab('log')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'log' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Activity log
        </button>
        <button
          type="button"
          onClick={() => setTab('settings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Notification settings
        </button>
      </div>

      {tab === 'log' && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by subject or recipient…"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <select
              title="Status filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
              <option value="SKIPPED">Skipped</option>
            </select>
            <select
              title="Type filter"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">All types</option>
              {ALL_EMAIL_TYPES.map((t) => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <DateInput value={from} onChange={setFrom} title="From date" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm w-[130px]" />
              <DateInput value={to} onChange={setTo} title="To date" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm w-[130px]" />
            </div>
          </div>

          {/* List */}
          {loading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
          ) : logs.length === 0 ? (
            <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">No emails match your filters.</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {logs.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setSelected(log)}
                    className="w-full text-left rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm active:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1">{log.subject}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{log.to.join(', ')}</p>
                      </div>
                      <Badge variant={statusVariant[log.status]}>{log.status}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">{emailTypeLabel(log.type)} · {fmtDate(log.createdAt)}</p>
                  </button>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block rounded-xl border bg-white overflow-hidden">
                <table className="w-full table-fixed divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 text-[10px] font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left w-[14%]">Type</th>
                      <th className="px-3 py-2 text-left w-[20%]">Recipient</th>
                      <th className="px-3 py-2 text-left w-[30%]">Subject</th>
                      <th className="px-3 py-2 text-left w-[12%]">Status</th>
                      <th className="px-3 py-2 text-left w-[16%]">Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logs.map((log) => (
                      <tr key={log.id} onClick={() => setSelected(log)} className="hover:bg-indigo-50 cursor-pointer transition-colors">
                        <td className="px-3 py-2 text-gray-600 truncate">{emailTypeLabel(log.type)}</td>
                        <td className="px-3 py-2 text-gray-700 truncate">{log.to.join(', ')}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 truncate">{log.subject}</td>
                        <td className="px-3 py-2"><Badge variant={statusVariant[log.status]}>{log.status}</Badge></td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'settings' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">Turn individual notification types off without touching code. Disabled emails still show up in the log as &quot;Skipped&quot;.</p>
          {!settings ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
          ) : (
            settings.map((g) => (
              <div key={g.group} className="rounded-xl border bg-white overflow-hidden">
                <div className="border-b bg-gray-50 px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-gray-700">{g.group}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {g.types.map((t) => (
                    <div key={t.type} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800">{t.label}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button type="button" onClick={() => openPreview(t.type)} className="text-xs text-indigo-600 hover:underline font-medium">
                          Preview
                        </button>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={t.enabled}
                            disabled={savingType === t.type}
                            onChange={(e) => toggleSetting(t.type, e.target.checked)}
                            aria-label={`Toggle ${t.label}`}
                          />
                          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
                          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={emailTypeLabel(selected.type)} size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant[selected.status]}>{selected.status}</Badge>
              <span className="text-xs text-gray-400">Attempt {selected.attempts}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-medium uppercase text-gray-400">To</p>
                <p className="text-gray-800">{selected.to.join(', ')}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase text-gray-400">Sent</p>
                <p className="text-gray-800">{selected.sentAt ? fmtDate(selected.sentAt) : '—'}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase text-gray-400">Subject</p>
              <p className="text-gray-800 text-sm">{selected.subject}</p>
            </div>
            {selected.errorMessage && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-[10px] font-medium uppercase text-red-500 mb-1">Error</p>
                <p className="text-xs text-red-700">{selected.errorMessage}</p>
              </div>
            )}
            {selected.status === 'FAILED' && (
              <Button onClick={retry} loading={retrying}>Retry now</Button>
            )}
          </div>
        </Modal>
      )}

      {/* Preview modal */}
      {previewType && (
        <Modal open={!!previewType} onClose={() => setPreviewType(null)} title={`Preview — ${emailTypeLabel(previewType)}`} size="lg">
          {previewLoading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
          ) : previewHtml ? (
            <iframe title="Email preview" srcDoc={previewHtml} className="w-full h-[500px] rounded-lg border border-gray-200" />
          ) : (
            <p className="text-sm text-gray-400 py-6 text-center">Could not load preview.</p>
          )}
        </Modal>
      )}

      {/* Compose announcement modal */}
      <Modal open={composeOpen} onClose={() => { setComposeOpen(false); setComposeResult(null) }} title="Compose announcement">
        <form onSubmit={sendBroadcast} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Subject</label>
            <input required value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)}
              placeholder="Scheduled maintenance this weekend"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Message</label>
            <textarea required rows={5} value={composeBody} onChange={(e) => setComposeBody(e.target.value)}
              placeholder="M4U Travel will be briefly unavailable..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Send to</label>
            <select title="Recipient role" value={composeRole} onChange={(e) => setComposeRole(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Everyone</option>
              <option value="EMPLOYEE">Employees</option>
              <option value="MANAGER">Managers</option>
              <option value="TRAVEL_MANAGER">Travel Managers</option>
              <option value="TRAVEL_AGENT">Travel Agents</option>
              <option value="FINANCE_ADMIN">Finance Admins</option>
              <option value="SYSTEM_ADMIN">System Admins</option>
            </select>
          </div>
          {composeResult && <p className="text-sm text-gray-600">{composeResult}</p>}
          <Button type="submit" loading={composeSending}>Send announcement</Button>
        </form>
      </Modal>
    </div>
  )
}
