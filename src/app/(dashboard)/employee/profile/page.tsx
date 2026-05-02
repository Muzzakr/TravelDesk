'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type AirlineAccount = { airline: string; number: string }

type Profile = {
  profilePhotoKey: string | null
  passportNumber: string | null
  passportExpiry: string | null
  passportPhotoKey: string | null
  driversLicenseNumber: string | null
  driversLicenseExpiry: string | null
  driversLicensePhotoKey: string | null
  ktnNumber: string | null
  globalEntryNumber: string | null
  airlineAccounts: AirlineAccount[] | null
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  return iso.split('T')[0]
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [uploadingField, setUploadingField] = useState<string | null>(null)

  const [passportNumber, setPassportNumber] = useState('')
  const [passportExpiry, setPassportExpiry] = useState('')
  const [driversLicenseNumber, setDriversLicenseNumber] = useState('')
  const [driversLicenseExpiry, setDriversLicenseExpiry] = useState('')
  const [ktnNumber, setKtnNumber] = useState('')
  const [globalEntryNumber, setGlobalEntryNumber] = useState('')
  const [airlineAccounts, setAirlineAccounts] = useState<AirlineAccount[]>([])

  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [photoSaved, setPhotoSaved] = useState(false)

  const profilePhotoRef = useRef<HTMLInputElement>(null)
  const passportPhotoRef = useRef<HTMLInputElement>(null)
  const dlPhotoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data: Profile) => {
        setProfile(data)
        setPassportNumber(data.passportNumber ?? '')
        setPassportExpiry(toDateInput(data.passportExpiry))
        setDriversLicenseNumber(data.driversLicenseNumber ?? '')
        setDriversLicenseExpiry(toDateInput(data.driversLicenseExpiry))
        setKtnNumber(data.ktnNumber ?? '')
        setGlobalEntryNumber(data.globalEntryNumber ?? '')
        setAirlineAccounts(data.airlineAccounts ?? [])
        if (data.profilePhotoKey) {
          fetch('/api/profile/photo-url?field=profilePhotoKey')
            .then((r) => r.json())
            .then((d: { url: string | null }) => { if (d.url) setProfilePhotoUrl(d.url) })
        }
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passportNumber: passportNumber || undefined,
        passportExpiry: passportExpiry || undefined,
        driversLicenseNumber: driversLicenseNumber || undefined,
        driversLicenseExpiry: driversLicenseExpiry || undefined,
        ktnNumber: ktnNumber || undefined,
        globalEntryNumber: globalEntryNumber || undefined,
        airlineAccounts: airlineAccounts.filter((a) => a.airline && a.number),
      }),
    })

    if (res.ok) {
      const updated: Profile = await res.json()
      setProfile(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to save profile')
    }
    setSaving(false)
  }

  async function uploadPhoto(field: 'profilePhotoKey' | 'passportPhotoKey' | 'driversLicensePhotoKey', file: File) {
    setUploadingField(field)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('field', field)
    const res = await fetch('/api/profile/photo', { method: 'POST', body: fd })
    if (res.ok) {
      const { key } = await res.json()
      setProfile((p) => p ? { ...p, [field]: key } : p)
      if (field === 'profilePhotoKey') {
        const urlRes = await fetch('/api/profile/photo-url?field=profilePhotoKey')
        const d = await urlRes.json() as { url: string | null }
        if (d.url) setProfilePhotoUrl(d.url)
        setPhotoSaved(true)
        setTimeout(() => setPhotoSaved(false), 3000)
      }
    }
    setUploadingField(null)
  }

  function addAirlineRow() {
    setAirlineAccounts((prev) => [...prev, { airline: '', number: '' }])
  }

  function removeAirlineRow(index: number) {
    setAirlineAccounts((prev) => prev.filter((_, i) => i !== index))
  }

  function updateAirlineRow(index: number, key: keyof AirlineAccount, value: string) {
    setAirlineAccounts((prev) => prev.map((row, i) => i === index ? { ...row, [key]: value } : row))
  }

  if (!profile) return <p className="text-sm text-gray-400">Loading profile…</p>

  const initials = '?'

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      <form onSubmit={handleSave} className="space-y-8">

        {/* Profile picture */}
        <section className="rounded-xl border bg-white p-6 flex items-center gap-6">
          <div className="relative shrink-0">
            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt="Profile photo"
                className="w-24 h-24 rounded-full object-cover border-2 border-indigo-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 border-2 border-indigo-200">
                {initials}
              </div>
            )}
            {uploadingField === 'profilePhotoKey' && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 mb-1">Profile photo</p>
            <input
              ref={profilePhotoRef}
              type="file"
              accept="image/*"
              aria-label="Upload profile photo"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto('profilePhotoKey', f) }}
            />
            <button
              type="button"
              onClick={() => profilePhotoRef.current?.click()}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {profile.profilePhotoKey ? 'Replace photo' : 'Upload photo'}
            </button>
            {photoSaved && <p className="mt-1.5 text-xs text-green-600 font-medium">✓ Photo saved</p>}
          </div>
        </section>

        {/* Travel Documents */}
        <section className="rounded-xl border bg-white p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">Travel documents</h2>

          {/* Passport */}
          <div>
            <p className="mb-3 text-sm font-medium text-gray-700">Passport</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Passport number" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} placeholder="A12345678" />
              <Input label="Expiry date" type="date" value={passportExpiry} onChange={(e) => setPassportExpiry(e.target.value)} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input ref={passportPhotoRef} type="file" accept="image/*,application/pdf" aria-label="Upload passport photo" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto('passportPhotoKey', f) }} />
              <button type="button" onClick={() => passportPhotoRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                {uploadingField === 'passportPhotoKey' ? 'Uploading…' : profile.passportPhotoKey ? 'Replace photo/scan' : 'Upload photo/scan'}
              </button>
              {profile.passportPhotoKey && (
                <span className="text-xs text-green-600 font-medium">✓ Document on file</span>
              )}
            </div>
          </div>

          {/* Driver's License */}
          <div>
            <p className="mb-3 text-sm font-medium text-gray-700">Driver&apos;s license</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="License number" value={driversLicenseNumber} onChange={(e) => setDriversLicenseNumber(e.target.value)} placeholder="DL-123456" />
              <Input label="Expiry date" type="date" value={driversLicenseExpiry} onChange={(e) => setDriversLicenseExpiry(e.target.value)} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input ref={dlPhotoRef} type="file" accept="image/*,application/pdf" aria-label="Upload driver's license photo" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto('driversLicensePhotoKey', f) }} />
              <button type="button" onClick={() => dlPhotoRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                {uploadingField === 'driversLicensePhotoKey' ? 'Uploading…' : profile.driversLicensePhotoKey ? 'Replace photo/scan' : 'Upload photo/scan'}
              </button>
              {profile.driversLicensePhotoKey && (
                <span className="text-xs text-green-600 font-medium">✓ Document on file</span>
              )}
            </div>
          </div>
        </section>

        {/* Travel Programs */}
        <section className="rounded-xl border bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Travel programs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Known Traveler Number (TSA PreCheck)" value={ktnNumber} onChange={(e) => setKtnNumber(e.target.value)} placeholder="12345678" />
            <Input label="Global Entry number" value={globalEntryNumber} onChange={(e) => setGlobalEntryNumber(e.target.value)} placeholder="987654321" />
          </div>
        </section>

        {/* Airline Accounts */}
        <section className="rounded-xl border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Airline loyalty accounts</h2>
            <button type="button" onClick={addAirlineRow}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
              + Add airline
            </button>
          </div>

          {airlineAccounts.length === 0 && (
            <p className="text-sm text-gray-400">No airline accounts added yet.</p>
          )}

          <div className="space-y-3">
            {airlineAccounts.map((row, i) => (
              <div key={i} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Airline</label>
                  <input value={row.airline} onChange={(e) => updateAirlineRow(i, 'airline', e.target.value)}
                    placeholder="SAS, Lufthansa, United…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Frequent flyer number</label>
                  <input value={row.number} onChange={(e) => updateAirlineRow(i, 'number', e.target.value)}
                    placeholder="EB123456789"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                </div>
                <button type="button" onClick={() => removeAirlineRow(i)}
                  className="mb-0.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-100">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        {saved && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700 font-medium">✓ Profile saved successfully.</p>}

        <Button type="submit" loading={saving}>Save profile</Button>
      </form>
    </div>
  )
}
