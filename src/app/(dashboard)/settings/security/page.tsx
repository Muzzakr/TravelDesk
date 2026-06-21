'use client'

import { useState, useEffect } from 'react'
import { Lock, Eye, EyeOff, ShieldCheck, ShieldOff } from 'lucide-react'

const inputCls = 'rounded-xl border border-gray-200 px-3 py-2.5 text-sm w-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white'

type MfaStatus = { mfaEnabled: boolean }

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

export default function SecuritySettingsPage() {
  // ── Password ──────────────────────────────────────────
  const [current,     setCurrent]     = useState('')
  const [next,        setNext]        = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext,    setShowNext]    = useState(false)
  const [pwSaving,    setPwSaving]    = useState(false)
  const [pwSuccess,   setPwSuccess]   = useState('')
  const [pwError,     setPwError]     = useState('')

  // ── MFA ───────────────────────────────────────────────
  const [mfaEnabled,  setMfaEnabled]  = useState(false)
  const [mfaLoading,  setMfaLoading]  = useState(true)

  // Enable flow
  const [setupStep,   setSetupStep]   = useState<'idle' | 'qr' | 'verify'>('idle')
  const [qrCode,      setQrCode]      = useState('')
  const [secret,      setSecret]      = useState('')
  const [setupCode,   setSetupCode]   = useState('')
  const [setupSaving, setSetupSaving] = useState(false)
  const [setupError,  setSetupError]  = useState('')

  // Disable flow
  const [disableOpen, setDisableOpen] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [disableSaving, setDisableSaving] = useState(false)
  const [disableError,  setDisableError]  = useState('')

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(s => { setMfaEnabled(!!s?.user?.mfaEnabled); setMfaLoading(false) })
  }, [])

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwSuccess(''); setPwError('')
    if (next !== confirm) { setPwError('New passwords do not match.'); return }
    if (next.length < 8)  { setPwError('Password must be at least 8 characters.'); return }
    setPwSaving(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const data = await res.json()
    if (res.ok) { setPwSuccess('Password updated successfully.'); setCurrent(''); setNext(''); setConfirm('') }
    else setPwError(data.error ?? 'Failed to update password.')
    setPwSaving(false)
  }

  async function startSetup() {
    setSetupError(''); setSetupCode('')
    const res = await fetch('/api/auth/mfa/setup')
    if (!res.ok) { setSetupError('Could not start setup. Try again.'); return }
    const d = await res.json()
    setQrCode(d.qrCode); setSecret(d.secret); setSetupStep('qr')
  }

  async function verifySetup() {
    if (setupCode.length < 6) { setSetupError('Enter the 6-digit code from your app.'); return }
    setSetupSaving(true); setSetupError('')
    const res = await fetch('/api/auth/mfa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: setupCode }),
    })
    const d = await res.json()
    if (res.ok) { setMfaEnabled(true); setSetupStep('idle'); setSetupCode('') }
    else setSetupError(d.error ?? 'Invalid code. Try again.')
    setSetupSaving(false)
  }

  async function disableMfa() {
    if (!disableCode) { setDisableError('Enter your authenticator code.'); return }
    setDisableSaving(true); setDisableError('')
    const res = await fetch('/api/auth/mfa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: disableCode }),
    })
    const d = await res.json()
    if (res.ok) { setMfaEnabled(false); setDisableOpen(false); setDisableCode('') }
    else setDisableError(d.error ?? 'Invalid code.')
    setDisableSaving(false)
  }

  return (
    <div className="max-w-lg mx-auto pb-12 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Security</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your password and two-factor authentication.</p>
      </div>

      {/* ── Change password ── */}
      <Section icon={Lock} title="Change password">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Current password</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)}
                required className={inputCls + ' pr-10'} placeholder="••••••••" />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">New password</label>
            <div className="relative">
              <input type={showNext ? 'text' : 'password'} value={next} onChange={e => setNext(e.target.value)}
                required minLength={8} className={inputCls + ' pr-10'} placeholder="Min. 8 characters" />
              <button type="button" onClick={() => setShowNext(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Confirm new password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              required className={inputCls} placeholder="Repeat new password" />
          </div>

          {pwError   && <p className="text-sm text-red-600 rounded-xl bg-red-50 px-3 py-2">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-green-700 rounded-xl bg-green-50 px-3 py-2">{pwSuccess}</p>}

          <button type="submit" disabled={pwSaving || !current || !next || !confirm}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-semibold transition-colors">
            {pwSaving ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </Section>

      {/* ── Two-factor authentication ── */}
      <Section icon={ShieldCheck} title="Two-factor authentication (2FA)">
        {mfaLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : mfaEnabled ? (
          <div className="space-y-4">
            {/* Enabled state */}
            <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">2FA is enabled</p>
                <p className="text-xs text-green-600">Your account is protected with an authenticator app.</p>
              </div>
            </div>

            {!disableOpen ? (
              <button type="button" onClick={() => { setDisableOpen(true); setDisableError(''); setDisableCode('') }}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 text-sm font-medium transition-colors">
                <ShieldOff className="w-4 h-4" />
                Disable 2FA
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Enter your authenticator code to confirm</p>
                <input className={inputCls + ' font-mono tracking-widest text-center text-lg'} maxLength={6}
                  value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000" />
                {disableError && <p className="text-sm text-red-600">{disableError}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={disableMfa} disabled={disableSaving}
                    className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-semibold">
                    {disableSaving ? 'Disabling…' : 'Confirm disable'}
                  </button>
                  <button type="button" onClick={() => setDisableOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : setupStep === 'idle' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
              <ShieldOff className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-700">2FA is not enabled</p>
                <p className="text-xs text-gray-500">Add an extra layer of security to your account.</p>
              </div>
            </div>
            {setupError && <p className="text-sm text-red-600 rounded-xl bg-red-50 px-3 py-2">{setupError}</p>}
            <button type="button" onClick={startSetup}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-sm font-semibold transition-colors">
              <ShieldCheck className="w-4 h-4" />
              Enable 2FA
            </button>
          </div>
        ) : setupStep === 'qr' ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="MFA QR code" className="w-48 h-48 rounded-xl border border-gray-200 bg-white p-2 mx-auto" />
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Or enter this code manually:</p>
              <p className="font-mono text-sm text-gray-800 break-all select-all">{secret}</p>
            </div>
            <button type="button" onClick={() => setSetupStep('verify')}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-sm font-semibold">
              I've scanned it →
            </button>
            <button type="button" onClick={() => setSetupStep('idle')}
              className="w-full rounded-xl border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Enter the <strong>6-digit code</strong> from your authenticator app to confirm setup.</p>
            <input className={inputCls + ' font-mono tracking-widest text-center text-2xl'} maxLength={6}
              value={setupCode} onChange={e => setSetupCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000" autoFocus />
            {setupError && <p className="text-sm text-red-600 rounded-xl bg-red-50 px-3 py-2">{setupError}</p>}
            <button type="button" onClick={verifySetup} disabled={setupSaving || setupCode.length < 6}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 text-sm font-semibold">
              {setupSaving ? 'Verifying…' : 'Activate 2FA'}
            </button>
            <button type="button" onClick={() => setSetupStep('qr')}
              className="w-full rounded-xl border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50">
              ← Back to QR code
            </button>
          </div>
        )}
      </Section>
    </div>
  )
}
