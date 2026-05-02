'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

interface AccountsData {
  company: { name: string; slug: string; plan: string; createdAt: string }
  byRole: Record<string, User[]>
}

const ROLE_ORDER = ['SYSTEM_ADMIN', 'FINANCE_ADMIN', 'TRAVEL_AGENT', 'MANAGER', 'EMPLOYEE']

const ROLE_LABEL: Record<string, string> = {
  SYSTEM_ADMIN: 'System Admin',
  FINANCE_ADMIN: 'Finance Admin',
  TRAVEL_AGENT: 'Travel Agent',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
}

const ROLE_COLOR: Record<string, 'gray' | 'yellow' | 'purple' | 'green' | 'blue'> = {
  SYSTEM_ADMIN: 'gray',
  FINANCE_ADMIN: 'yellow',
  TRAVEL_AGENT: 'purple',
  MANAGER: 'green',
  EMPLOYEE: 'blue',
}

export default function AccountsPage() {
  const [data, setData] = useState<AccountsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/accounts')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Loading...</div>
  if (!data) return <div className="text-sm text-red-500 py-10 text-center">Failed to load accounts.</div>

  const { company, byRole } = data
  const totalUsers = ROLE_ORDER.reduce((sum, r) => sum + (byRole[r]?.length ?? 0), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">All accounts</h1>

      {/* Company card */}
      <div className="rounded-xl border bg-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{company.name}</p>
            <p className="text-xs text-gray-400">{company.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Plan</p>
            <p className="text-sm font-medium text-gray-700 capitalize">{company.plan}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Created</p>
            <p className="text-sm font-medium text-gray-700">{new Date(company.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Users</p>
            <p className="text-sm font-bold text-indigo-600">{totalUsers}</p>
          </div>
        </div>
      </div>

      {/* Users by role */}
      {ROLE_ORDER.map((role) => {
        const users = byRole[role] ?? []
        return (
          <section key={role}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</Badge>
              <span className="text-xs text-gray-400 font-medium">{users.length} {users.length === 1 ? 'person' : 'persons'}</span>
            </div>

            {users.length === 0 ? (
              <p className="text-xs text-gray-400 pl-1">No users with this role.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {users.map((user) => (
                  <div key={user.id} className="rounded-xl border bg-white px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      <p className="text-xs text-gray-300 mt-0.5">{new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={user.isActive ? 'green' : 'gray'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
