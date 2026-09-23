'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'

type EmailType = { type: string; label: string; enabled: boolean }
type EmailGroup = { group: string; types: EmailType[] }

export default function NotificationSettingsPage() {
  const [groups, setGroups] = useState<EmailGroup[] | null>(null)
  const [savingType, setSavingType] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings/notifications')
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => setError('Could not load your notification preferences.'))
  }, [])

  async function toggle(type: string, enabled: boolean) {
    setSavingType(type)
    setError('')
    setGroups((prev) => prev && prev.map((g) => ({ ...g, types: g.types.map((t) => (t.type === type ? { ...t, enabled } : t)) })))

    const res = await fetch('/api/settings/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, enabled }),
    })
    if (!res.ok) {
      setError('Failed to save. Please try again.')
      setGroups((prev) => prev && prev.map((g) => ({ ...g, types: g.types.map((t) => (t.type === type ? { ...t, enabled: !enabled } : t)) })))
    }
    setSavingType(null)
  }

  return (
    <div className="max-w-lg mx-auto pb-12 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Choose which emails you personally receive. Turning one off only affects you — everyone else still gets theirs, and you&apos;ll still see it in your in-app notifications.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 rounded-xl bg-red-50 px-3 py-2">{error}</p>}

      {!groups ? (
        <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center">
          <Bell className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No optional notification types apply to your account yet.</p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.group} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
              <Bell className="w-5 h-5 text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-800">{g.group}</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {g.types.map((t) => (
                <div key={t.type} className="flex items-center justify-between gap-3 px-6 py-3.5">
                  <p className="text-sm text-gray-700">{t.label}</p>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={t.enabled}
                      disabled={savingType === t.type}
                      onChange={(e) => toggle(t.type, e.target.checked)}
                      aria-label={`Toggle ${t.label}`}
                    />
                    <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
