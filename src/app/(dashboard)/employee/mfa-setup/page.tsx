'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import Image from 'next/image'
import { CheckCircle } from 'lucide-react'

export default function MfaSetupPage() {
  const [step, setStep] = useState<'idle' | 'scan' | 'done'>('idle')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function start() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/mfa/setup')
    if (res.ok) {
      const data = await res.json()
      setQrCode(data.qrCode)
      setSecret(data.secret)
      setStep('scan')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to start MFA setup')
    }
    setLoading(false)
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/mfa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (res.ok) {
      setStep('done')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Invalid code')
    }
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Set up two-factor authentication</h1>

      {step === 'idle' && (
        <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <p className="text-sm text-gray-600">
            Protect your account with an authenticator app (Google Authenticator, Authy, etc.).
          </p>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <Button onClick={start} loading={loading}>Enable MFA</Button>
        </div>
      )}

      {step === 'scan' && (
        <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <p className="text-sm text-gray-600">
            Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
          </p>
          {qrCode && (
            <div className="flex justify-center">
              <Image src={qrCode} alt="MFA QR code" width={200} height={200} />
            </div>
          )}
          <p className="text-xs text-gray-400 text-center break-all">Manual key: {secret}</p>
          <form onSubmit={confirm} className="flex flex-col gap-3">
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              pattern="\d{6}"
              placeholder="000000"
              className="rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl tracking-widest focus:border-indigo-500 focus:outline-none"
            />
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={loading}>Confirm code</Button>
          </form>
        </div>
      )}

      {step === 'done' && (
        <div className="rounded-xl bg-green-50 p-6 shadow-sm text-center space-y-3">
          <CheckCircle className="w-9 h-9 mx-auto text-green-600" />
          <p className="font-semibold text-green-800">MFA enabled successfully!</p>
          <p className="text-sm text-green-700">
            You will need your authenticator app to log in from now on.
          </p>
          <a href="/employee" className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Back to dashboard
          </a>
        </div>
      )}
    </div>
  )
}
