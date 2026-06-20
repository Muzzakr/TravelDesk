'use client'

import { useState, useEffect, useRef } from 'react'
import { Building2, Key, RefreshCw, Save, ShieldAlert, ImageIcon } from 'lucide-react'

type Settings = {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: string
  logoUrl: string | null
  webhookKey: string | null
  hasWebhookKey: boolean
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
        <Icon className="w-5 h-5 text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

const inputCls = 'rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white'
const readonlyCls = 'rounded-xl border border-gray-100 px-3 py-2.5 text-sm w-full bg-gray-50 text-gray-500 cursor-not-allowed'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')

  const [regenerating, setRegenerating] = useState(false)
  const [regenMsg, setRegenMsg] = useState('')
  const [regenErr, setRegenErr] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)

  const logoRef = useRef<HTMLInputElement>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoMsg, setLogoMsg] = useState('')
  const [logoErr, setLogoErr] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => {
        setSettings(d)
        setName(d.name ?? '')
      })
  }, [])

  async function saveCompanyName() {
    if (!name.trim()) { setSaveErr('Name cannot be empty'); return }
    setSaving(true); setSaveMsg(''); setSaveErr('')
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (res.ok) {
      const d = await res.json()
      setSettings(s => s ? { ...s, name: d.name } : s)
      setSaveMsg('Company name updated.')
    } else {
      const d = await res.json()
      setSaveErr(d.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true); setLogoMsg(''); setLogoErr('')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/admin/logo', { method: 'POST', body: fd })
    const d = await res.json()
    if (res.ok) {
      setSettings(s => s ? { ...s, logoUrl: d.logoUrl } : s)
      setLogoMsg('Logo updated.')
    } else {
      setLogoErr(d.error ?? 'Upload failed')
    }
    setLogoUploading(false)
    if (logoRef.current) logoRef.current.value = ''
  }

  async function removeLogo() {
    setLogoUploading(true); setLogoMsg(''); setLogoErr('')
    const res = await fetch('/api/admin/logo', { method: 'DELETE' })
    if (res.ok) {
      setSettings(s => s ? { ...s, logoUrl: null } : s)
      setLogoMsg('Logo removed.')
    } else {
      setLogoErr('Failed to remove logo')
    }
    setLogoUploading(false)
  }

  async function regenerateKey() {
    setRegenerating(true); setRegenMsg(''); setRegenErr(''); setNewKey(null)
    const res = await fetch('/api/admin/webhook-key/regenerate', { method: 'POST' })
    if (res.ok) {
      const d = await res.json()
      setNewKey(d.key ?? null)
      setRegenMsg('New key generated. Copy it now — it will not be shown again.')
      setSettings(s => s ? { ...s, hasWebhookKey: true, webhookKey: d.key ? `••••••••••••${d.key.slice(-8)}` : s.webhookKey } : s)
    } else {
      setRegenErr('Failed to regenerate key.')
    }
    setRegenerating(false)
  }

  if (!settings) return (
    <div className="flex items-center justify-center min-h-[40vh] text-sm text-gray-400">Loading…</div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your company profile and integrations.</p>
      </div>

      {/* Company Info */}
      <Section icon={Building2} title="Company information">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Company name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveCompanyName()} className={inputCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-500">Slug</label>
              <input type="text" value={settings.slug} readOnly className={readonlyCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-500">Plan</label>
              <input type="text" value={settings.plan} readOnly className={readonlyCls} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-500">Member since</label>
            <input type="text"
              value={new Date(settings.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              readOnly className={readonlyCls} />
          </div>

          {saveErr && <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{saveErr}</p>}
          {saveMsg && <p className="text-sm text-green-700 rounded-lg bg-green-50 px-3 py-2">{saveMsg}</p>}

          <button
            type="button"
            onClick={saveCompanyName}
            disabled={saving || name.trim() === settings.name}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </Section>

      {/* Company Logo */}
      <Section icon={ImageIcon} title="Company logo">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Shown in the sidebar. PNG, JPEG, SVG, or WebP — max 2 MB.</p>
          {settings.logoUrl ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.logoUrl} alt="Company logo" className="h-16 max-w-[200px] rounded-lg border border-gray-200 object-contain p-2 bg-white" />
              <button type="button" onClick={removeLogo} disabled={logoUploading}
                className="rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-100 disabled:opacity-50">
                {logoUploading ? 'Removing…' : 'Remove logo'}
              </button>
            </div>
          ) : (
            <div className="flex h-20 w-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 text-xs">
              No logo set
            </div>
          )}
          <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
            aria-label="Upload company logo" className="hidden" onChange={uploadLogo} />
          {logoErr && <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{logoErr}</p>}
          {logoMsg && <p className="text-sm text-green-700 rounded-lg bg-green-50 px-3 py-2">{logoMsg}</p>}
          <button type="button" disabled={logoUploading} onClick={() => logoRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-5 py-2.5 text-sm font-semibold transition-colors">
            {logoUploading ? 'Uploading…' : settings.logoUrl ? 'Change logo' : 'Upload logo'}
          </button>
        </div>
      </Section>

      {/* Webhook Key */}
      <Section icon={Key} title="Webhook API key">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Used to authenticate inbound webhook events from external systems (e.g. Slack, payment providers).
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-500">Current key</label>
            <div className={`${readonlyCls} font-mono`}>
              {settings.hasWebhookKey ? settings.webhookKey : <span className="text-gray-400 italic">No key set</span>}
            </div>
          </div>

          {newKey && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">New key — copy now, will not be shown again</p>
              <code className="text-sm font-mono text-amber-900 break-all select-all">{newKey}</code>
            </div>
          )}

          {regenErr && <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{regenErr}</p>}
          {regenMsg && !newKey && <p className="text-sm text-green-700 rounded-lg bg-green-50 px-3 py-2">{regenMsg}</p>}

          <button
            type="button"
            onClick={regenerateKey}
            disabled={regenerating}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Generating…' : settings.hasWebhookKey ? 'Regenerate key' : 'Generate key'}
          </button>
        </div>
      </Section>

      {/* Danger zone */}
      <Section icon={ShieldAlert} title="Danger zone">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Destructive actions. These cannot be undone. Contact support to deactivate or delete your company account.
          </p>
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Account deletion and data export are handled by the M4U Travel support team. Contact support to request these actions.
          </div>
        </div>
      </Section>
    </div>
  )
}
