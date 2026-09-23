'use client'

import { useState, useEffect, useRef } from 'react'
import { Building2, Key, RefreshCw, Save, ShieldAlert, ShieldCheck, ImageIcon, Webhook } from 'lucide-react'

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

type WebhookEventType = 'travel_request.approved' | 'expense.paid'

type OutboundWebhook = {
  url: string | null
  isActive: boolean
  eventTypes: WebhookEventType[]
  hasSecret: boolean
  secretMasked: string | null
}

type SsoSettings = {
  enabled: boolean
  enforced: boolean
  issuer: string
  clientId: string
  scopes: string
  jitProvisioningEnabled: boolean
  allowedDomain: string
  hasClientSecret: boolean
}

const OUTBOUND_EVENT_OPTIONS: { type: WebhookEventType; label: string }[] = [
  { type: 'travel_request.approved', label: 'Travel request approved' },
  { type: 'expense.paid', label: 'Expense paid' },
]

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

  const [outbound, setOutbound] = useState<OutboundWebhook | null>(null)
  const [outboundUrl, setOutboundUrl] = useState('')
  const [outboundActive, setOutboundActive] = useState(true)
  const [outboundEvents, setOutboundEvents] = useState<WebhookEventType[]>([])
  const [outboundSaving, setOutboundSaving] = useState(false)
  const [outboundMsg, setOutboundMsg] = useState('')
  const [outboundErr, setOutboundErr] = useState('')
  const [outboundRegenerating, setOutboundRegenerating] = useState(false)
  const [outboundNewSecret, setOutboundNewSecret] = useState<string | null>(null)
  const [outboundTesting, setOutboundTesting] = useState(false)
  const [outboundTestMsg, setOutboundTestMsg] = useState('')
  const [outboundTestErr, setOutboundTestErr] = useState('')

  const [sso, setSso] = useState<SsoSettings | null>(null)
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [ssoEnforced, setSsoEnforced] = useState(false)
  const [ssoIssuer, setSsoIssuer] = useState('')
  const [ssoClientId, setSsoClientId] = useState('')
  const [ssoClientSecret, setSsoClientSecret] = useState('')
  const [ssoScopes, setSsoScopes] = useState('openid email profile')
  const [ssoJit, setSsoJit] = useState(false)
  const [ssoDomain, setSsoDomain] = useState('')
  const [ssoSaving, setSsoSaving] = useState(false)
  const [ssoMsg, setSsoMsg] = useState('')
  const [ssoErr, setSsoErr] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => {
        setSettings(d)
        setName(d.name ?? '')
      })
    fetch('/api/admin/webhooks')
      .then(r => r.json())
      .then((d: OutboundWebhook) => {
        setOutbound(d)
        setOutboundUrl(d.url ?? '')
        setOutboundActive(d.isActive)
        setOutboundEvents(d.eventTypes)
      })
    fetch('/api/admin/sso')
      .then(r => r.json())
      .then((d: SsoSettings) => {
        setSso(d)
        setSsoEnabled(d.enabled)
        setSsoEnforced(d.enforced)
        setSsoIssuer(d.issuer)
        setSsoClientId(d.clientId)
        setSsoScopes(d.scopes)
        setSsoJit(d.jitProvisioningEnabled)
        setSsoDomain(d.allowedDomain)
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

  function toggleOutboundEvent(type: WebhookEventType, checked: boolean) {
    setOutboundEvents(prev => checked ? [...prev, type] : prev.filter(t => t !== type))
  }

  async function saveOutbound() {
    setOutboundSaving(true); setOutboundMsg(''); setOutboundErr('')
    const res = await fetch('/api/admin/webhooks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: outboundUrl.trim() || null, eventTypes: outboundEvents, isActive: outboundActive }),
    })
    if (res.ok) {
      setOutbound(o => o ? { ...o, url: outboundUrl.trim() || null, eventTypes: outboundEvents, isActive: outboundActive } : o)
      setOutboundMsg('Webhook settings saved.')
    } else {
      const d = await res.json()
      setOutboundErr(d.error ? JSON.stringify(d.error) : 'Failed to save')
    }
    setOutboundSaving(false)
  }

  async function regenerateOutboundSecret() {
    setOutboundRegenerating(true); setOutboundNewSecret(null); setOutboundErr('')
    const res = await fetch('/api/admin/webhooks/regenerate-secret', { method: 'POST' })
    if (res.ok) {
      const d = await res.json()
      setOutboundNewSecret(d.secret ?? null)
      setOutbound(o => o ? { ...o, hasSecret: true, secretMasked: d.secret ? `••••••••••••${d.secret.slice(-8)}` : o.secretMasked } : o)
    } else {
      setOutboundErr('Failed to regenerate secret.')
    }
    setOutboundRegenerating(false)
  }

  async function sendTestEvent() {
    setOutboundTesting(true); setOutboundTestMsg(''); setOutboundTestErr('')
    const res = await fetch('/api/admin/webhooks/test', { method: 'POST' })
    const d = await res.json()
    if (res.ok) setOutboundTestMsg('Test event delivered successfully.')
    else setOutboundTestErr(d.error ?? 'Test event failed')
    setOutboundTesting(false)
  }

  async function saveSso() {
    setSsoSaving(true); setSsoMsg(''); setSsoErr('')
    const res = await fetch('/api/admin/sso', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: ssoEnabled,
        enforced: ssoEnforced,
        issuer: ssoIssuer.trim(),
        clientId: ssoClientId.trim(),
        clientSecret: ssoClientSecret.trim() || undefined,
        scopes: ssoScopes.trim() || 'openid email profile',
        jitProvisioningEnabled: ssoJit,
        allowedDomain: ssoDomain.trim() || null,
      }),
    })
    const d = await res.json()
    if (res.ok) {
      setSso(d)
      setSsoClientSecret('')
      setSsoMsg('Single sign-on settings saved.')
    } else {
      setSsoErr(typeof d.error === 'string' ? d.error : 'Failed to save')
    }
    setSsoSaving(false)
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
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-3 text-sm font-semibold transition-colors min-h-[44px]"
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
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-5 py-3 text-sm font-semibold transition-colors min-h-[44px]">
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
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-5 py-3 text-sm font-semibold transition-colors min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Generating…' : settings.hasWebhookKey ? 'Regenerate key' : 'Generate key'}
          </button>
        </div>
      </Section>

      {/* Outbound webhooks */}
      <Section icon={Webhook} title="Outbound webhooks">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Get notified on your own systems when things happen in M4U Travel — e.g. a travel request is approved or an expense is paid.
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Endpoint URL</label>
            <input type="url" placeholder="https://example.com/webhooks/m4u"
              value={outboundUrl} onChange={e => setOutboundUrl(e.target.value)} className={inputCls} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Events</label>
            {OUTBOUND_EVENT_OPTIONS.map(opt => (
              <div key={opt.type} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-2.5">
                <span className="text-sm text-gray-700">{opt.label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={outboundEvents.includes(opt.type)}
                    onChange={e => toggleOutboundEvent(opt.type, e.target.checked)}
                    aria-label={`Toggle ${opt.label}`}
                  />
                  <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                </label>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-2.5">
            <span className="text-sm text-gray-700">Active</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={outboundActive}
                onChange={e => setOutboundActive(e.target.checked)}
                aria-label="Toggle webhook active"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </label>
          </div>

          {outboundErr && <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{outboundErr}</p>}
          {outboundMsg && <p className="text-sm text-green-700 rounded-lg bg-green-50 px-3 py-2">{outboundMsg}</p>}

          <button
            type="button"
            onClick={saveOutbound}
            disabled={outboundSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-3 text-sm font-semibold transition-colors min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            {outboundSaving ? 'Saving…' : 'Save changes'}
          </button>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-500">Signing secret</label>
              <div className={`${readonlyCls} font-mono`}>
                {outbound?.hasSecret ? outbound.secretMasked : <span className="text-gray-400 italic">No secret set</span>}
              </div>
            </div>

            {outboundNewSecret && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">New secret — copy now, will not be shown again</p>
                <code className="text-sm font-mono text-amber-900 break-all select-all">{outboundNewSecret}</code>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={regenerateOutboundSecret}
                disabled={outboundRegenerating}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-5 py-3 text-sm font-semibold transition-colors min-h-[44px]"
              >
                <RefreshCw className={`w-4 h-4 ${outboundRegenerating ? 'animate-spin' : ''}`} />
                {outboundRegenerating ? 'Generating…' : outbound?.hasSecret ? 'Regenerate secret' : 'Generate secret'}
              </button>

              <button
                type="button"
                onClick={sendTestEvent}
                disabled={outboundTesting || !outbound?.url || !outbound?.hasSecret}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-5 py-3 text-sm font-semibold transition-colors min-h-[44px]"
              >
                {outboundTesting ? 'Sending…' : 'Send test event'}
              </button>
            </div>

            {outboundTestErr && <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{outboundTestErr}</p>}
            {outboundTestMsg && <p className="text-sm text-green-700 rounded-lg bg-green-50 px-3 py-2">{outboundTestMsg}</p>}
          </div>
        </div>
      </Section>

      {/* Single Sign-On */}
      <Section icon={ShieldCheck} title="Single Sign-On">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Let employees sign in through your company&apos;s own identity provider (Okta, Azure AD / Entra, Google Workspace, Auth0, PingOne, etc.) via OIDC.
            SAML is not supported yet.
          </p>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-2.5">
            <span className="text-sm text-gray-700">Enabled</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={ssoEnabled}
                onChange={e => {
                  const checked = e.target.checked
                  setSsoEnabled(checked)
                  if (!checked) setSsoEnforced(false)
                }}
                aria-label="Toggle SSO enabled"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Issuer URL</label>
            <input type="url" placeholder="https://your-org.okta.com"
              value={ssoIssuer} onChange={e => setSsoIssuer(e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400">The OIDC issuer — its /.well-known/openid-configuration must be reachable.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Client ID</label>
              <input type="text" value={ssoClientId} onChange={e => setSsoClientId(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Client secret</label>
              <input type="password" placeholder={sso?.hasClientSecret ? '••••••••••••••••  (leave blank to keep)' : 'Enter client secret'}
                value={ssoClientSecret} onChange={e => setSsoClientSecret(e.target.value)} className={inputCls} autoComplete="new-password" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Scopes</label>
            <input type="text" value={ssoScopes} onChange={e => setSsoScopes(e.target.value)} className={inputCls} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Allowed email domain</label>
            <input type="text" placeholder="example.com"
              value={ssoDomain} onChange={e => setSsoDomain(e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400">Required to enable just-in-time provisioning below.</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-2.5">
            <div>
              <span className="text-sm text-gray-700">Just-in-time provisioning</span>
              <p className="text-xs text-gray-400">Auto-create an account on first SSO sign-in for a matching email domain.</p>
            </div>
            <label className={`relative inline-flex items-center ${ssoDomain.trim() ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
              <input
                type="checkbox"
                className="sr-only peer"
                checked={ssoJit}
                disabled={!ssoDomain.trim()}
                onChange={e => setSsoJit(e.target.checked)}
                aria-label="Toggle just-in-time provisioning"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-2.5">
            <div>
              <span className="text-sm text-gray-700">Require SSO</span>
              <p className="text-xs text-gray-400">Disables password and Google sign-in for this company.</p>
            </div>
            <label className={`relative inline-flex items-center ${ssoEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
              <input
                type="checkbox"
                className="sr-only peer"
                checked={ssoEnforced}
                disabled={!ssoEnabled}
                onChange={e => setSsoEnforced(e.target.checked)}
                aria-label="Toggle SSO enforced"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </label>
          </div>

          {ssoErr && <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{ssoErr}</p>}
          {ssoMsg && <p className="text-sm text-green-700 rounded-lg bg-green-50 px-3 py-2">{ssoMsg}</p>}

          <button
            type="button"
            onClick={saveSso}
            disabled={ssoSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-3 text-sm font-semibold transition-colors min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            {ssoSaving ? 'Saving…' : 'Save changes'}
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
