'use client'

import { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'

type UserRow = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  manager: { name: string } | null
}

// Manager kan bara se dessa roller — inte MANAGER eller SYSTEM_ADMIN
const ALLOWED_ROLES = ['EMPLOYEE', 'TRAVEL_AGENT', 'FINANCE_ADMIN']

const roleBadge: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
  EMPLOYEE:     'blue',
  TRAVEL_AGENT: 'purple',
  FINANCE_ADMIN: 'yellow',
}

const ROLE_OPTIONS = [
  { value: 'EMPLOYEE',     label: 'Employee' },
  { value: 'TRAVEL_AGENT', label: 'Travel Agent' },
  { value: 'FINANCE_ADMIN', label: 'Finance Admin' },
]

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}

export default function ManagerUsersPage() {
  const [allUsers, setAllUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<UserRow | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  async function loadUsers() {
    const res = await fetch('/api/users')
    if (res.ok) {
      const data: UserRow[] = await res.json()
      // Filter: only show allowed roles
      setAllUsers(data.filter((u) => ALLOWED_ROLES.includes(u.role)))
    } else {
      setError('Failed to load users')
    }
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    if (!selected) return
    function onMouseDown(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setSelected(null)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [selected])

  const users = allUsers.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    if (statusFilter === 'active' && !u.isActive) return false
    if (statusFilter === 'inactive' && u.isActive) return false
    return true
  })

  const counts = {
    total:        allUsers.length,
    active:       allUsers.filter((u) => u.isActive).length,
    employee:     allUsers.filter((u) => u.role === 'EMPLOYEE').length,
    travelAgent:  allUsers.filter((u) => u.role === 'TRAVEL_AGENT').length,
    financeAdmin: allUsers.filter((u) => u.role === 'FINANCE_ADMIN').length,
  }

  return (
    <div className="space-y-6">

      {/* Detail drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20 pointer-events-none" />
          <div ref={drawerRef} className="fixed right-0 top-0 h-full w-full max-w-md z-[51] flex flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div className="min-w-0 pr-4">
                <p className="text-xs text-gray-400">{selected.email}</p>
                <h2 className="mt-0.5 text-lg font-semibold text-gray-900 leading-tight">{selected.name}</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelected(null)}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={roleBadge[selected.role] ?? 'gray'}>{selected.role.replace(/_/g, ' ')}</Badge>
                  <Badge variant={selected.isActive ? 'green' : 'gray'}>{selected.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="Email" value={selected.email} />
                  <DetailRow label="Reports to" value={selected.manager?.name ?? null} />
                </div>

                <DetailRow
                  label="Joined"
                  value={new Date(selected.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">Your team members and their roles</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white px-5 py-4">
          <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
          <p className="text-xs font-semibold text-gray-700 mt-0.5">Total</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{counts.active} active</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-5 py-4">
          <p className="text-2xl font-bold text-blue-600">{counts.employee}</p>
          <p className="text-xs font-semibold text-gray-700 mt-0.5">Employees</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-5 py-4">
          <p className="text-2xl font-bold text-purple-600">{counts.travelAgent}</p>
          <p className="text-xs font-semibold text-gray-700 mt-0.5">Travel Agents</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-5 py-4">
          <p className="text-2xl font-bold text-yellow-600">{counts.financeAdmin}</p>
          <p className="text-xs font-semibold text-gray-700 mt-0.5">Finance Admins</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          title="Filter by role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        >
          <option value="">All Roles</option>
          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          title="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {(roleFilter || statusFilter) && (
          <button
            type="button"
            onClick={() => { setRoleFilter(''); setStatusFilter('') }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {/* User list */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : users.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
          No users found.
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelected(u)}
                className="w-full text-left rounded-xl border bg-white p-4 space-y-2 hover:bg-gray-50 active:bg-gray-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <Badge variant={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={roleBadge[u.role] ?? 'gray'}>{u.role.replace(/_/g, ' ')}</Badge>
                  {u.manager && <span className="text-xs text-gray-400">Reports to: {u.manager.name}</span>}
                </div>
                <p className="text-xs text-gray-400">
                  Joined {new Date(u.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                </p>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[500px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Reports to</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className="hover:bg-indigo-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[160px]">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={roleBadge[u.role] ?? 'gray'}>{u.role.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell truncate max-w-[128px]">
                      {u.manager?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
