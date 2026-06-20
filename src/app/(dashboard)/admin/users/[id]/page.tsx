'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useParams } from 'next/navigation'

const roleBadge: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
  EMPLOYEE: 'blue', MANAGER: 'green', TRAVEL_MANAGER: 'green',
  TRAVEL_AGENT: 'purple', FINANCE_ADMIN: 'yellow', SYSTEM_ADMIN: 'gray',
}

type Profile = {
  passportNumber: string | null
  passportExpiry: string | null
  passportPhotoKey: string | null
  driversLicenseNumber: string | null
  driversLicenseExpiry: string | null
  driversLicensePhotoKey: string | null
  ktnNumber: string | null
  globalEntryNumber: string | null
  airlineAccounts: { airline: string; number: string }[] | null
}

type UserData = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  manager: { name: string; email: string } | null
  travelerProfile: Profile | null
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

function toInputDate(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

export default function AdminUserProfilePage() {
  const params = useParams<{ id: string }>()
  const userId = params.id

  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    passportNumber: '', passportExpiry: '',
    driversLicenseNumber: '', driversLicenseExpiry: '',
    ktnNumber: '', globalEntryNumber: '',
    loyaltyAccounts: [] as { airline: string; number: string }[],
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    fetch(`/api/admin/users/${userId}/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(setUser)
      .finally(() => setLoading(false))
  }, [userId])

  function startEdit() {
    const p = user?.travelerProfile
    setForm({
      passportNumber: p?.passportNumber ?? '',
      passportExpiry: toInputDate(p?.passportExpiry),
      driversLicenseNumber: p?.driversLicenseNumber ?? '',
      driversLicenseExpiry: toInputDate(p?.driversLicenseExpiry),
      ktnNumber: p?.ktnNumber ?? '',
      globalEntryNumber: p?.globalEntryNumber ?? '',
      loyaltyAccounts: p?.airlineAccounts ?? [],
    })
    setSaveMsg(''); setSaveErr('')
    setEditing(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaveErr(''); setSaveMsg('')
    const res = await fetch(`/api/admin/users/${userId}/travel-docs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passportNumber: form.passportNumber || null,
        passportExpiry: form.passportExpiry || null,
        driversLicenseNumber: form.driversLicenseNumber || null,
        driversLicenseExpiry: form.driversLicenseExpiry || null,
        ktnNumber: form.ktnNumber || null,
        globalEntryNumber: form.globalEntryNumber || null,
        loyaltyAccounts: form.loyaltyAccounts.filter(a => a.airline && a.number),
      }),
    })
    if (res.ok) {
      setSaveMsg('Saved!')
      const fresh = await fetch(`/api/admin/users/${userId}/profile`).then(r => r.ok ? r.json() : null)
      if (fresh) setUser(fresh)
      setEditing(false)
    } else {
      const d = await res.json()
      setSaveErr(d.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  function addLoyalty() {
    setForm(f => ({ ...f, loyaltyAccounts: [...f.loyaltyAccounts, { airline: '', number: '' }] }))
  }
  function removeLoyalty(i: number) {
    setForm(f => ({ ...f, loyaltyAccounts: f.loyaltyAccounts.filter((_, idx) => idx !== i) }))
  }
  function updateLoyalty(i: number, field: 'airline' | 'number', val: string) {
    setForm(f => {
      const updated = [...f.loyaltyAccounts]
      updated[i] = { ...updated[i], [field]: val }
      return { ...f, loyaltyAccounts: updated }
    })
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>
  if (!user) return <div className="p-8 text-sm text-red-500">User not found.</div>

  const profile = user.travelerProfile
  const airlineAccounts = profile?.airlineAccounts ?? []

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-gray-400 hover:text-gray-600">← Users</Link>
      </div>

      {/* User header */}
      <div className="rounded-xl border bg-white p-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
          {user.manager && <p className="text-xs text-gray-400 mt-1">Manager: {user.manager.name}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={roleBadge[user.role] ?? 'gray'}>{user.role.replace(/_/g, ' ')}</Badge>
          <Badge variant={user.isActive ? 'green' : 'gray'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
      </div>

      {!profile && !editing ? (
        <div className="rounded-xl border bg-white p-6 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400">This user has not set up a traveler profile yet.</p>
          <Button onClick={startEdit}>Add travel docs</Button>
        </div>
      ) : editing ? (
        <form onSubmit={save} className="space-y-5">
          <div className="rounded-xl border bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Travel documents</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Passport number</label>
                <input value={form.passportNumber} onChange={e => setForm(f => ({ ...f, passportNumber: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" placeholder="A12345678" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Passport expiry</label>
                <input type="date" title="Passport expiry" value={form.passportExpiry} onChange={e => setForm(f => ({ ...f, passportExpiry: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Driver&apos;s license</label>
                <input title="Driver's license number" value={form.driversLicenseNumber} onChange={e => setForm(f => ({ ...f, driversLicenseNumber: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">License expiry</label>
                <input type="date" title="License expiry" value={form.driversLicenseExpiry} onChange={e => setForm(f => ({ ...f, driversLicenseExpiry: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Travel programs</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">KTN (TSA PreCheck)</label>
                <input title="KTN number" value={form.ktnNumber} onChange={e => setForm(f => ({ ...f, ktnNumber: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Global Entry</label>
                <input title="Global Entry number" value={form.globalEntryNumber} onChange={e => setForm(f => ({ ...f, globalEntryNumber: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Airline loyalty accounts</h2>
              <button type="button" onClick={addLoyalty}
                className="inline-flex items-center gap-1 rounded-lg text-sm font-medium text-indigo-600 hover:text-indigo-800">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {form.loyaltyAccounts.length === 0 ? (
              <p className="text-sm text-gray-400">No loyalty accounts.</p>
            ) : form.loyaltyAccounts.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={a.airline} onChange={e => updateLoyalty(i, 'airline', e.target.value)}
                  placeholder="Airline" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                <input value={a.number} onChange={e => updateLoyalty(i, 'number', e.target.value)}
                  placeholder="Account #" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                <button type="button" aria-label="Remove loyalty account" onClick={() => removeLoyalty(i)}
                  className="shrink-0 text-gray-400 hover:text-red-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {saveErr && <p className="text-sm text-red-600">{saveErr}</p>}

          <div className="flex gap-3">
            <Button type="submit" loading={saving}>Save changes</Button>
            <button type="button" onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {saveMsg && <p className="text-sm text-green-600">{saveMsg}</p>}

          {/* Travel documents */}
          <section className="rounded-xl border bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Travel documents</h2>
              <Button onClick={startEdit}>Edit</Button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Passport number</p>
                <p className="mt-1 text-gray-900">{profile?.passportNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Passport expiry</p>
                <p className="mt-1 text-gray-900">{fmtDate(profile?.passportExpiry)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Passport scan</p>
                <p className="mt-1">
                  {profile?.passportPhotoKey
                    ? <span className="inline-flex items-center gap-1 text-green-600 font-medium"><Check className="w-3.5 h-3.5" /> On file</span>
                    : <span className="text-gray-400">—</span>}
                </p>
              </div>
              <div></div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Driver&apos;s license</p>
                <p className="mt-1 text-gray-900">{profile?.driversLicenseNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">License expiry</p>
                <p className="mt-1 text-gray-900">{fmtDate(profile?.driversLicenseExpiry)}</p>
              </div>
            </div>
          </section>

          {/* Travel programs */}
          <section className="rounded-xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Travel programs</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">KTN (TSA PreCheck)</p>
                <p className="mt-1 text-gray-900">{profile?.ktnNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Global Entry</p>
                <p className="mt-1 text-gray-900">{profile?.globalEntryNumber ?? '—'}</p>
              </div>
            </div>
          </section>

          {/* Airline accounts */}
          <section className="rounded-xl border bg-white p-6 space-y-3">
            <h2 className="text-base font-semibold text-gray-800">Airline loyalty accounts</h2>
            {airlineAccounts.length === 0 ? (
              <p className="text-sm text-gray-400">None on file.</p>
            ) : (
              <div className="space-y-2">
                {airlineAccounts.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5 text-sm">
                    <span className="font-medium text-gray-800">{a.airline}</span>
                    <span className="font-mono text-gray-600">{a.number}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
