'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateInput } from '@/components/ui/DateInput'
import { Check, Sparkles } from 'lucide-react'
import { LoadError } from '@/components/ui/LoadError'

type AirlineAccount = { airline: string; number: string }

type ScanResult = {
  documentNumber: string | null
  dateOfBirth: string | null
  issueDate: string | null
  expiryDate?: string | null
}

async function compressForOcr(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1800
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => resolve(new File([blob!], 'scan.jpg', { type: 'image/jpeg' })),
        'image/jpeg',
        0.88,
      )
    }
    img.src = url
  })
}

type Profile = {
  profilePhotoKey: string | null
  firstName: string | null
  lastName: string | null
  phoneNumber: string | null
  contactEmail: string | null
  homeAddress: string | null
  dateOfBirth: string | null
  passportNumber: string | null
  passportIssueDate: string | null
  passportExpiry: string | null
  passportPhotoKey: string | null
  driversLicenseNumber: string | null
  driversLicenseIssueDate: string | null
  driversLicenseExpiry: string | null
  driversLicensePhotoKey: string | null
  ktnNumber: string | null
  globalEntryNumber: string | null
  airlineAccounts: AirlineAccount[] | null
  userEmail?: string
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  return iso.split('T')[0]
}

function validateImageFile(file: File, opts: { allowPdf?: boolean; maxMb?: number }): string | null {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', ...(opts.allowPdf ? ['application/pdf'] : [])]
  if (!allowed.includes(file.type)) {
    const labels = allowed.map(t => t.split('/')[1].toUpperCase()).join(', ')
    return `Only ${labels} files are allowed`
  }
  const maxBytes = (opts.maxMb ?? 10) * 1024 * 1024
  if (file.size > maxBytes) return `File too large (max ${opts.maxMb ?? 10} MB)`
  return null
}

const CROP_SIZE = 240

function CropModal({ objectUrl, onCancel, onSave }: {
  objectUrl: string
  onCancel: () => void
  onSave: (blob: Blob) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1.5)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  const draw = useCallback((img: HTMLImageElement, sc: number, ox: number, oy: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const r = CROP_SIZE / 2
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE)
    ctx.save()
    ctx.beginPath()
    ctx.arc(r, r, r, 0, Math.PI * 2)
    ctx.clip()
    const w = img.naturalWidth * sc
    const h = img.naturalHeight * sc
    ctx.drawImage(img, r - w / 2 + ox, r - h / 2 + oy, w, h)
    ctx.restore()
    // ring
    ctx.beginPath()
    ctx.arc(r, r, r - 1, 0, Math.PI * 2)
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [])

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      draw(img, scale, offset.x, offset.y)
    }
    img.src = objectUrl
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectUrl])

  useEffect(() => {
    if (imgRef.current) draw(imgRef.current, scale, offset.x, offset.y)
  }, [scale, offset, draw])

  function startDrag(mx: number, my: number) {
    dragStart.current = { mx, my, ox: offset.x, oy: offset.y }
  }
  function moveDrag(mx: number, my: number) {
    if (!dragStart.current) return
    const dx = mx - dragStart.current.mx
    const dy = my - dragStart.current.my
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
  }
  function endDrag() { dragStart.current = null }

  function handleSave() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => { if (blob) onSave(blob) }, 'image/jpeg', 0.92)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: '1rem' }}>
      <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center gap-4 w-full max-w-xs">
        <p className="text-sm font-semibold text-gray-800">Crop profile photo</p>
        <canvas
          ref={canvasRef}
          width={CROP_SIZE}
          height={CROP_SIZE}
          className="rounded-full cursor-grab active:cursor-grabbing touch-none w-60 h-60"
          onMouseDown={e => startDrag(e.clientX, e.clientY)}
          onMouseMove={e => moveDrag(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={e => { const t = e.touches[0]; startDrag(t.clientX, t.clientY) }}
          onTouchMove={e => { e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY) }}
          onTouchEnd={endDrag}
        />
        <div className="w-full">
          <label className="text-xs text-gray-500 mb-1 block">Zoom</label>
          <input type="range" min={0.5} max={3} step={0.05} value={scale}
            aria-label="Zoom level"
            onChange={e => setScale(+e.target.value)}
            className="w-full accent-indigo-600" />
        </div>
        <div className="flex gap-3 w-full">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Save & upload
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')

  const [userEmail, setUserEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [homeAddress, setHomeAddress] = useState('')

  const [dateOfBirth, setDateOfBirth] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [passportIssueDate, setPassportIssueDate] = useState('')
  const [passportExpiry, setPassportExpiry] = useState('')

  const [driversLicenseNumber, setDriversLicenseNumber] = useState('')
  const [driversLicenseIssueDate, setDriversLicenseIssueDate] = useState('')
  const [driversLicenseExpiry, setDriversLicenseExpiry] = useState('')

  const [ktnNumber, setKtnNumber] = useState('')
  const [globalEntryNumber, setGlobalEntryNumber] = useState('')
  const [airlineAccounts, setAirlineAccounts] = useState<AirlineAccount[]>([])

  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [passportPhotoUrl, setPassportPhotoUrl] = useState<string | null>(null)
  const [dlPhotoUrl, setDlPhotoUrl] = useState<string | null>(null)
  const [photoSaved, setPhotoSaved] = useState(false)

  const [scanningPassport, setScanningPassport] = useState(false)
  const [passportScanMsg, setPassportScanMsg]   = useState('')
  const [scanningDl, setScanningDl]             = useState(false)
  const [dlScanMsg, setDlScanMsg]               = useState('')
  const [passportScanStep, setPassportScanStep] = useState('')
  const [dlScanStep, setDlScanStep]             = useState('')
  const [passportScanResult, setPassportScanResult] = useState<ScanResult | null>(null)
  const [dlScanResult, setDlScanResult]             = useState<ScanResult | null>(null)

  const [cropFile, setCropFile] = useState<{ file: File; objectUrl: string } | null>(null)

  const profilePhotoRef  = useRef<HTMLInputElement>(null)
  const passportPhotoRef = useRef<HTMLInputElement>(null)
  const passportScanRef  = useRef<HTMLInputElement>(null)
  const dlPhotoRef       = useRef<HTMLInputElement>(null)
  const dlScanRef        = useRef<HTMLInputElement>(null)

  const [loadError, setLoadError] = useState(false)

  function loadProfile() {
    setLoadError(false)
    fetch('/api/profile')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data: Profile) => {
        setProfile(data)
        setUserEmail(data.userEmail ?? data.contactEmail ?? '')
        setFirstName(data.firstName ?? '')
        setLastName(data.lastName ?? '')
        setPhoneNumber(data.phoneNumber ?? '')
        setContactEmail(data.contactEmail ?? '')
        setHomeAddress(data.homeAddress ?? '')
        setDateOfBirth(toDateInput(data.dateOfBirth))
        setPassportNumber(data.passportNumber ?? '')
        setPassportIssueDate(toDateInput(data.passportIssueDate))
        setPassportExpiry(toDateInput(data.passportExpiry))
        setDriversLicenseNumber(data.driversLicenseNumber ?? '')
        setDriversLicenseIssueDate(toDateInput(data.driversLicenseIssueDate))
        setDriversLicenseExpiry(toDateInput(data.driversLicenseExpiry))
        setKtnNumber(data.ktnNumber ?? '')
        setGlobalEntryNumber(data.globalEntryNumber ?? '')
        setAirlineAccounts(data.airlineAccounts ?? [])
        if (data.profilePhotoKey) {
          fetch('/api/profile/photo-url?field=profilePhotoKey')
            .then(r => r.json()).then((d: { url: string | null }) => { if (d.url) setProfilePhotoUrl(d.url) })
        }
        if (data.passportPhotoKey) {
          fetch('/api/profile/photo-url?field=passportPhotoKey')
            .then(r => r.json()).then((d: { url: string | null }) => { if (d.url) setPassportPhotoUrl(d.url) })
        }
        if (data.driversLicensePhotoKey) {
          fetch('/api/profile/photo-url?field=driversLicensePhotoKey')
            .then(r => r.json()).then((d: { url: string | null }) => { if (d.url) setDlPhotoUrl(d.url) })
        }
      })
      .catch(() => setLoadError(true))
  }

  useEffect(() => { loadProfile() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phoneNumber: phoneNumber || undefined,
        contactEmail: contactEmail || undefined,
        homeAddress: homeAddress || undefined,
        dateOfBirth: dateOfBirth || undefined,
        passportNumber: passportNumber || undefined,
        passportIssueDate: passportIssueDate || undefined,
        passportExpiry: passportExpiry || undefined,
        driversLicenseNumber: driversLicenseNumber || undefined,
        driversLicenseIssueDate: driversLicenseIssueDate || undefined,
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
    setUploadError('')
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
      if (field === 'passportPhotoKey') {
        const urlRes = await fetch('/api/profile/photo-url?field=passportPhotoKey')
        const d = await urlRes.json() as { url: string | null }
        if (d.url) setPassportPhotoUrl(d.url)
      }
      if (field === 'driversLicensePhotoKey') {
        const urlRes = await fetch('/api/profile/photo-url?field=driversLicensePhotoKey')
        const d = await urlRes.json() as { url: string | null }
        if (d.url) setDlPhotoUrl(d.url)
      }
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string }
      setUploadError(d.error ?? 'Upload failed — please try again')
    }
    setUploadingField(null)
  }

  async function scanDocument(file: File, type: 'passport' | 'drivers_license') {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('documentType', type)
    const res = await fetch('/api/profile/ocr-scan', { method: 'POST', body: fd })
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string; detail?: string }
      throw new Error(d.detail ? `${d.error}: ${d.detail}` : (d.error ?? 'Could not read document — please fill in manually.'))
    }
    return res.json() as Promise<{
      documentNumber: string | null
      dateOfBirth: string | null
      issueDate: string | null
      expiryDate?: string | null
    }>
  }

  function applyPassportScan() {
    if (!passportScanResult) return
    if (passportScanResult.documentNumber) setPassportNumber(passportScanResult.documentNumber)
    if (passportScanResult.dateOfBirth)    setDateOfBirth(passportScanResult.dateOfBirth)
    if (passportScanResult.issueDate)      setPassportIssueDate(passportScanResult.issueDate)
    if (passportScanResult.expiryDate)     setPassportExpiry(passportScanResult.expiryDate)
    setPassportScanResult(null)
    setPassportScanMsg('')
  }

  function applyDlScan() {
    if (!dlScanResult) return
    if (dlScanResult.documentNumber) setDriversLicenseNumber(dlScanResult.documentNumber)
    if (dlScanResult.dateOfBirth)    setDateOfBirth(dlScanResult.dateOfBirth)
    if (dlScanResult.issueDate)      setDriversLicenseIssueDate(dlScanResult.issueDate)
    if (dlScanResult.expiryDate)     setDriversLicenseExpiry(dlScanResult.expiryDate)
    setDlScanResult(null)
    setDlScanMsg('')
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

  if (!profile) {
    if (loadError) return <LoadError onRetry={loadProfile} />
    return <p className="text-sm text-gray-400">Loading profile…</p>
  }

  const initials = '?'

  return (
    <div className="max-w-2xl space-y-6">
      {cropFile && (
        <CropModal
          objectUrl={cropFile.objectUrl}
          onCancel={() => { URL.revokeObjectURL(cropFile.objectUrl); setCropFile(null) }}
          onSave={async (blob) => {
            URL.revokeObjectURL(cropFile.objectUrl)
            setCropFile(null)
            await uploadPhoto('profilePhotoKey', new File([blob], 'profile.jpg', { type: 'image/jpeg' }))
          }}
        />
      )}

      <h1 className="text-2xl font-bold text-gray-900 text-center">My Profile</h1>

      <form onSubmit={handleSave} className="space-y-8">

        {/* Profile picture */}
        <div className="flex flex-col items-center gap-2">
          <label className="relative shrink-0 cursor-pointer group">
            <input
              ref={profilePhotoRef}
              type="file"
              accept="image/*"
              aria-label="Upload profile photo"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const err = validateImageFile(f, { allowPdf: false, maxMb: 10 })
                if (err) { setUploadError(err); e.target.value = ''; return }
                const objectUrl = URL.createObjectURL(f)
                setCropFile({ file: f, objectUrl })
                e.target.value = ''
              }}
            />
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
            {uploadingField === 'profilePhotoKey' ? (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>
            ) : (
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-indigo-600 group-hover:bg-indigo-700 border-2 border-white flex items-center justify-center text-white text-lg font-light leading-none transition-colors">
                +
              </div>
            )}
          </label>
          {photoSaved && <p className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="w-3.5 h-3.5" /> Photo saved</p>}
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        </div>

        {/* Contact information */}
        <section className="rounded-xl border bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Contact information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First name *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
            />
            <Input
              label="Last name *"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Smith"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Input
                label="Phone number *"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 555 123 4567"
              />
              <p className="text-xs text-gray-400">Include country code, e.g. +46 70 123 4567</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Email address
                <span className="ml-1 text-xs text-gray-400 font-normal">(from your account)</span>
              </label>
              <input
                type="email"
                value={userEmail}
                readOnly
                aria-label="Email address (from your account)"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 cursor-default outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Home address</label>
            <textarea
              value={homeAddress}
              onChange={(e) => setHomeAddress(e.target.value)}
              placeholder="123 Main St, Chicago, IL 60601"
              rows={3}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
            />
          </div>
        </section>

        {/* Travel Documents */}
        <section className="rounded-xl border bg-white p-6 space-y-6">
          <h2 className="text-base font-semibold text-gray-800">Travel documents</h2>

          {/* Passport */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Passport <span className="text-red-500">*</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Passport number *" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} placeholder="A12345678" />
              <DateInput label="Date of birth *" value={dateOfBirth} onChange={setDateOfBirth} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateInput label="Issue date *" value={passportIssueDate} onChange={setPassportIssueDate} />
              <DateInput label="Expiry date *" value={passportExpiry} onChange={setPassportExpiry} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={passportPhotoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" aria-label="Upload passport photo" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]; if (!f) return
                  const err = validateImageFile(f, { allowPdf: true, maxMb: 10 })
                  if (err) { setUploadError(err); e.target.value = ''; return }
                  uploadPhoto('passportPhotoKey', f)
                  e.target.value = ''
                }} />
              <input ref={passportScanRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Scan passport" className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return
                  if (/\.(heic|heif)$/i.test(f.name) || f.type === 'image/heic') {
                    setPassportScanMsg('error:iPhone HEIC format not supported — take a screenshot instead (PNG/JPEG).')
                    e.target.value = ''; return
                  }
                  const err = validateImageFile(f, { allowPdf: false, maxMb: 20 })
                  if (err) { setPassportScanMsg('error:' + err); e.target.value = ''; return }
                  setScanningPassport(true); setPassportScanMsg(''); setPassportScanResult(null)
                  try {
                    setPassportScanStep('Compressing image…')
                    const compressed = await compressForOcr(f)
                    setPassportScanStep('Reading document…')
                    const r = await scanDocument(compressed, 'passport')
                    setPassportScanResult(r)
                  } catch (err) {
                    setPassportScanMsg('error:' + (err instanceof Error ? err.message : 'Could not read document — please fill in manually.'))
                  } finally { setScanningPassport(false); setPassportScanStep(''); e.target.value = '' }
                }}
              />
              <button type="button" onClick={() => passportPhotoRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                {uploadingField === 'passportPhotoKey' ? 'Uploading…' : profile.passportPhotoKey ? 'Replace photo/scan' : 'Upload photo/scan'}
              </button>
              <button type="button" onClick={() => { setPassportScanMsg(''); passportScanRef.current?.click() }}
                disabled={scanningPassport}
                className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                {scanningPassport ? (passportScanStep || 'Scanning…') : <><Sparkles className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />Scan & autofill</>}
              </button>
              {passportPhotoUrl && (
                <a href={passportPhotoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" title="View uploaded passport">
                  <img src={passportPhotoUrl} alt="Passport" className="w-16 h-10 rounded object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
                </a>
              )}
              {profile.passportPhotoKey && !passportPhotoUrl && <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="w-3.5 h-3.5" /> Document on file</span>}
              {passportScanMsg && !passportScanResult && (
                <span className={`text-xs ${passportScanMsg.startsWith('error:') ? 'text-red-500' : 'text-gray-500'}`}>
                  {passportScanMsg.replace(/^error:/, '')}
                </span>
              )}
            </div>
            {passportScanResult && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-indigo-700">Review extracted fields before applying</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {passportScanResult.documentNumber && (<><dt className="text-gray-500">Passport #</dt><dd className="font-medium text-gray-900">{passportScanResult.documentNumber}</dd></>)}
                  {passportScanResult.dateOfBirth && (<><dt className="text-gray-500">Date of birth</dt><dd className="font-medium text-gray-900">{passportScanResult.dateOfBirth}</dd></>)}
                  {passportScanResult.issueDate && (<><dt className="text-gray-500">Issue date</dt><dd className="font-medium text-gray-900">{passportScanResult.issueDate}</dd></>)}
                  {passportScanResult.expiryDate && (<><dt className="text-gray-500">Expiry</dt><dd className="font-medium text-gray-900">{passportScanResult.expiryDate}</dd></>)}
                </dl>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={applyPassportScan} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Apply fields</button>
                  <button type="button" onClick={() => { setPassportScanResult(null); setPassportScanMsg('') }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Discard</button>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-gray-100" />

          {/* Driver's License */}
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-700">To book a car rental, please fill in your driver&apos;s license details or upload a photo/scan of your license.</p>
            </div>
            <p className="text-sm font-medium text-gray-700">Driver&apos;s license</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Document number" value={driversLicenseNumber} onChange={(e) => setDriversLicenseNumber(e.target.value)} placeholder="DL-123456" />
              <DateInput label="Date of birth" value={dateOfBirth} onChange={setDateOfBirth} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateInput label="Issue date" value={driversLicenseIssueDate} onChange={setDriversLicenseIssueDate} />
              <DateInput label="Expiry date" value={driversLicenseExpiry} onChange={setDriversLicenseExpiry} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={dlPhotoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" aria-label="Upload driver's license photo" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]; if (!f) return
                  const err = validateImageFile(f, { allowPdf: true, maxMb: 10 })
                  if (err) { setUploadError(err); e.target.value = ''; return }
                  uploadPhoto('driversLicensePhotoKey', f)
                  e.target.value = ''
                }} />
              <input ref={dlScanRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Scan driver's license" className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return
                  if (/\.(heic|heif)$/i.test(f.name) || f.type === 'image/heic') {
                    setDlScanMsg('error:iPhone HEIC format not supported — take a screenshot instead (PNG/JPEG).')
                    e.target.value = ''; return
                  }
                  const err = validateImageFile(f, { allowPdf: false, maxMb: 20 })
                  if (err) { setDlScanMsg('error:' + err); e.target.value = ''; return }
                  setScanningDl(true); setDlScanMsg(''); setDlScanResult(null)
                  try {
                    setDlScanStep('Compressing image…')
                    const compressed = await compressForOcr(f)
                    setDlScanStep('Reading document…')
                    const r = await scanDocument(compressed, 'drivers_license')
                    setDlScanResult(r)
                  } catch (err) {
                    setDlScanMsg('error:' + (err instanceof Error ? err.message : 'Could not read document — please fill in manually.'))
                  } finally { setScanningDl(false); setDlScanStep(''); e.target.value = '' }
                }}
              />
              <button type="button" onClick={() => dlPhotoRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                {uploadingField === 'driversLicensePhotoKey' ? 'Uploading…' : profile.driversLicensePhotoKey ? 'Replace photo/scan' : 'Upload photo/scan'}
              </button>
              <button type="button" onClick={() => { setDlScanMsg(''); dlScanRef.current?.click() }}
                disabled={scanningDl}
                className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                {scanningDl ? (dlScanStep || 'Scanning…') : <><Sparkles className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />Scan & autofill</>}
              </button>
              {dlPhotoUrl && (
                <a href={dlPhotoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" title="View uploaded license">
                  <img src={dlPhotoUrl} alt="Driver's license" className="w-16 h-10 rounded object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
                </a>
              )}
              {profile.driversLicensePhotoKey && !dlPhotoUrl && <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="w-3.5 h-3.5" /> Document on file</span>}
              {dlScanMsg && !dlScanResult && (
                <span className={`text-xs ${dlScanMsg.startsWith('error:') ? 'text-red-500' : 'text-gray-500'}`}>
                  {dlScanMsg.replace(/^error:/, '')}
                </span>
              )}
            </div>
            {dlScanResult && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-indigo-700">Review extracted fields before applying</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {dlScanResult.documentNumber && (<><dt className="text-gray-500">License #</dt><dd className="font-medium text-gray-900">{dlScanResult.documentNumber}</dd></>)}
                  {dlScanResult.dateOfBirth && (<><dt className="text-gray-500">Date of birth</dt><dd className="font-medium text-gray-900">{dlScanResult.dateOfBirth}</dd></>)}
                  {dlScanResult.issueDate && (<><dt className="text-gray-500">Issue date</dt><dd className="font-medium text-gray-900">{dlScanResult.issueDate}</dd></>)}
                  {dlScanResult.expiryDate && (<><dt className="text-gray-500">Expiry</dt><dd className="font-medium text-gray-900">{dlScanResult.expiryDate}</dd></>)}
                </dl>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={applyDlScan} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Apply fields</button>
                  <button type="button" onClick={() => { setDlScanResult(null); setDlScanMsg('') }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Discard</button>
                </div>
              </div>
            )}
          </div>

          {uploadError && (
            <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">{uploadError}</p>
          )}
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
        {saved && <p className="inline-flex items-center gap-1 rounded-lg bg-green-50 p-3 text-sm text-green-700 font-medium"><Check className="w-4 h-4" /> Profile saved successfully.</p>}

        <Button type="submit" loading={saving}>Save profile</Button>
      </form>
    </div>
  )
}
