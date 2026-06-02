'use client'

import { PaperAirplaneIcon, BuildingOfficeIcon, TruckIcon, MapPinIcon, PlusCircleIcon, InboxIcon } from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'
type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

type InboxChannel = 'TRAVEL_CARS' | 'TRAVEL_FLIGHTS' | 'TRAVEL_HOTELS'
type InboxStatus  = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'IGNORED'

interface ParsedData {
  serviceType?:   string
  employeeName?:  string
  origin?:        string
  destination?:   string
  departureDate?: string
  returnDate?:    string
  notes?:         string
}

interface InboxMessage {
  id:              string
  channel:         InboxChannel
  slackUserName:   string | null
  rawText:         string
  parsedData:      ParsedData | null
  status:          InboxStatus
  assignedToId:    string | null
  travelRequestId: string | null
  createdAt:       string
  assignedTo:      { id: string; name: string } | null
}

interface EmployeeProfile {
  user:    { id: string; name: string; email: string } | null
  profile: Record<string, string | null> | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNEL_META: Record<InboxChannel, { label: string; Icon: HeroIcon; color: string; pill: string; border: string }> = {
  TRAVEL_CARS:    { label: 'Cars',    Icon: TruckIcon,          color: 'text-amber-700',   pill: 'bg-amber-100 text-amber-800',    border: 'border-l-amber-400' },
  TRAVEL_FLIGHTS: { label: 'Flights', Icon: PaperAirplaneIcon,  color: 'text-indigo-700',  pill: 'bg-indigo-100 text-indigo-800',  border: 'border-l-indigo-400' },
  TRAVEL_HOTELS:  { label: 'Hotels',  Icon: BuildingOfficeIcon, color: 'text-emerald-700', pill: 'bg-emerald-100 text-emerald-800', border: 'border-l-emerald-400' },
}

const SERVICE_ICONS: Record<string, HeroIcon> = {
  FLIGHT: PaperAirplaneIcon, HOTEL: BuildingOfficeIcon, CAR_RENTAL: TruckIcon, TAXI: MapPinIcon,
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentInboxPage() {
  const router = useRouter()
  const [messages,     setMessages]     = useState<InboxMessage[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState<'ALL' | InboxChannel>('ALL')
  const [statusFilter, setStatusFilter] = useState<InboxStatus | 'ALL'>('NEW')
  const [search,       setSearch]       = useState('')
  const [agentId,      setAgentId]      = useState<string>('')
  const [clarifyId,    setClarifyId]    = useState<string | null>(null)
  const [clarifyText,  setClarifyText]  = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [profileData,  setProfileData]  = useState<EmployeeProfile | null>(null)
  const [profileMsgId, setProfileMsgId] = useState<string | null>(null)
  const [newCount,     setNewCount]     = useState(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(s => setAgentId(s?.user?.id ?? ''))
  }, [])

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (activeTab !== 'ALL') params.set('channel', activeTab)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (search) params.set('search', search)

    const [msgs, newMsgs] = await Promise.all([
      fetch(`/api/inbox?${params}`).then(r => r.json()),
      fetch('/api/inbox?status=NEW&take=100').then(r => r.json()),
    ])
    setMessages(Array.isArray(msgs) ? msgs : [])
    setNewCount(Array.isArray(newMsgs) ? newMsgs.length : 0)
    setLoading(false)
  }, [activeTab, statusFilter, search])

  useEffect(() => {
    setLoading(true)
    load()
    pollingRef.current = setInterval(load, 30_000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [load])

  async function patch(id: string, data: Partial<{ status: InboxStatus; assignedToId: string; travelRequestId: string }>) {
    await fetch(`/api/inbox/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await load()
  }

  function handleCreateBooking(msg: InboxMessage) {
    const p = msg.parsedData ?? {}
    const params = new URLSearchParams({ inbox_id: msg.id })
    if (p.employeeName) params.set('employee', p.employeeName)
    if (p.destination)  params.set('destination', p.destination)
    if (p.origin)       params.set('origin', p.origin)
    if (p.departureDate) params.set('departure', p.departureDate)
    if (p.returnDate)   params.set('return', p.returnDate)
    const svc = p.serviceType || (
      msg.channel === 'TRAVEL_CARS'    ? 'CAR_RENTAL' :
      msg.channel === 'TRAVEL_FLIGHTS' ? 'FLIGHT'     : 'HOTEL'
    )
    params.set('service', svc)
    patch(msg.id, { status: 'IN_PROGRESS' }).catch(() => {})
    router.push(`/agent/book?${params}`)
  }

  async function handleAssign(msg: InboxMessage) {
    await patch(msg.id, { status: 'IN_PROGRESS', assignedToId: agentId })
  }

  async function handleDone(msg: InboxMessage) {
    await patch(msg.id, { status: 'DONE' })
  }

  async function handleIgnore(msg: InboxMessage) {
    await patch(msg.id, { status: 'IGNORED' })
  }

  async function handleSendReply(id: string) {
    if (!clarifyText.trim()) return
    setSendingReply(true)
    const res = await fetch(`/api/inbox/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clarifyText }),
    })
    setSendingReply(false)
    if (res.ok) { setClarifyId(null); setClarifyText('') }
  }

  async function handleViewProfile(msg: InboxMessage) {
    setProfileMsgId(msg.id)
    setProfileData(null)
    const res = await fetch(`/api/inbox/${msg.id}/employee-profile`)
    if (res.ok) setProfileData(await res.json())
  }

  const tabs: { key: 'ALL' | InboxChannel; label: string; Icon: HeroIcon }[] = [
    { key: 'ALL',           label: 'All',    Icon: InboxIcon },
    { key: 'TRAVEL_FLIGHTS', label: 'Flights', Icon: PaperAirplaneIcon },
    { key: 'TRAVEL_HOTELS',  label: 'Hotels',  Icon: BuildingOfficeIcon },
    { key: 'TRAVEL_CARS',    label: 'Cars',    Icon: TruckIcon },
  ]

  const statusOptions: { key: InboxStatus | 'ALL'; label: string }[] = [
    { key: 'ALL',         label: 'All statuses' },
    { key: 'NEW',         label: 'New' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'DONE',        label: 'Done' },
    { key: 'IGNORED',     label: 'Ignored' },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Travel Inbox
            {newCount > 0 && (
              <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">{newCount} new</span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Incoming travel requests from Slack channels — auto-refreshes every 30s</p>
        </div>
        <button
          onClick={() => { setLoading(true); load() }}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <t.Icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as InboxStatus | 'ALL')}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {statusOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>

        <input
          type="text"
          placeholder="Search messages…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* Message feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border bg-white p-16 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500 text-sm">No messages match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(msg => {
            const meta    = CHANNEL_META[msg.channel]
            const parsed  = msg.parsedData ?? {}
            const isMyMsg = msg.assignedToId === agentId
            const isClarifying = clarifyId === msg.id
            const isViewingProfile = profileMsgId === msg.id
            const SvcIcon = parsed.serviceType ? (SERVICE_ICONS[parsed.serviceType] ?? PlusCircleIcon) : PlusCircleIcon

            return (
              <div
                key={msg.id}
                className={`rounded-2xl border-2 border-l-4 bg-white p-5 transition-shadow hover:shadow-sm ${meta.border} ${msg.status === 'DONE' || msg.status === 'IGNORED' ? 'opacity-60' : ''}`}
              >
                {/* Card header */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.pill}`}>
                    <meta.Icon className="w-3.5 h-3.5" /> {meta.label}
                  </span>
                  {msg.slackUserName && (
                    <span className="text-xs text-gray-500">@{msg.slackUserName}</span>
                  )}
                  <span className="text-xs text-gray-400">{timeAgo(msg.createdAt)}</span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    msg.status === 'NEW'         ? 'bg-red-100 text-red-700' :
                    msg.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                    msg.status === 'DONE'        ? 'bg-green-100 text-green-700' :
                                                   'bg-gray-100 text-gray-500'
                  }`}>
                    {msg.status.replace('_', ' ')}
                  </span>
                  {msg.assignedTo && (
                    <span className="text-xs text-indigo-600 font-medium">{isMyMsg ? 'You' : msg.assignedTo.name}</span>
                  )}
                </div>

                {/* Raw message */}
                <p className="text-sm text-gray-800 leading-relaxed mb-3 bg-gray-50 rounded-xl px-4 py-3 font-mono border border-gray-100">
                  {msg.rawText}
                </p>

                {/* Parsed chips */}
                {(parsed.serviceType || parsed.destination || parsed.departureDate) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {parsed.serviceType && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        <SvcIcon className="w-3.5 h-3.5" /> {parsed.serviceType.replace('_', ' ')}
                      </span>
                    )}
                    {(parsed.origin || parsed.destination) && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">
                        📍 {[parsed.origin, parsed.destination].filter(Boolean).join(' → ')}
                      </span>
                    )}
                    {parsed.departureDate && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">
                        📅 {fmtDate(parsed.departureDate)}{parsed.returnDate ? ` → ${fmtDate(parsed.returnDate)}` : ''}
                      </span>
                    )}
                    {parsed.employeeName && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">
                        👤 {parsed.employeeName}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                {msg.status !== 'DONE' && msg.status !== 'IGNORED' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleCreateBooking(msg)}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                    >
                      Create Booking
                    </button>
                    {!msg.assignedToId && (
                      <button
                        onClick={() => handleAssign(msg)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Assign to Me
                      </button>
                    )}
                    <button
                      onClick={() => handleDone(msg)}
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                    >
                      Mark Done
                    </button>
                    <button
                      onClick={() => setClarifyId(isClarifying ? null : msg.id)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      Ask Clarification
                    </button>
                    <button
                      onClick={() => { setProfileMsgId(isViewingProfile ? null : null); handleViewProfile(msg) }}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      title="View employee profile"
                    >
                      👤 Profile
                    </button>
                    <button
                      onClick={() => handleIgnore(msg)}
                      className="ml-auto rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      Ignore
                    </button>
                  </div>
                )}

                {/* Clarify input */}
                {isClarifying && (
                  <div className="mt-3 flex gap-2">
                    <textarea
                      value={clarifyText}
                      onChange={e => setClarifyText(e.target.value)}
                      placeholder="Type your clarification message… (will be sent as a reply in Slack)"
                      rows={2}
                      className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                    />
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => handleSendReply(msg.id)}
                        disabled={sendingReply || !clarifyText.trim()}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {sendingReply ? 'Sending…' : 'Send'}
                      </button>
                      <button
                        onClick={() => { setClarifyId(null); setClarifyText('') }}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Profile panel */}
                {isViewingProfile && profileData !== null && (
                  <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                    {!profileData.user ? (
                      <p className="text-gray-500 text-xs">No matching employee profile found for &quot;{parsed.employeeName || 'unknown'}&quot;.</p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-900">{profileData.user.name}</p>
                          <button onClick={() => setProfileMsgId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <p className="text-xs text-gray-500">{profileData.user.email}</p>
                        {profileData.profile && (
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs">
                            {profileData.profile.phoneNumber   && <><span className="text-gray-400">Phone</span><span>{profileData.profile.phoneNumber}</span></>}
                            {profileData.profile.passportNumber && <><span className="text-gray-400">Passport</span><span>{profileData.profile.passportNumber}</span></>}
                            {profileData.profile.ktnNumber     && <><span className="text-gray-400">TSA PreCheck</span><span>{profileData.profile.ktnNumber}</span></>}
                            {profileData.profile.globalEntryNumber && <><span className="text-gray-400">Global Entry</span><span>{profileData.profile.globalEntryNumber}</span></>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
