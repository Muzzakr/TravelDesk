'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function MFAPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    if (!res.ok) {
      setError('Invalid code. Please try again.')
      setLoading(false)
      return
    }

    const sessionRes = await fetch('/api/auth/session')
    const session = await sessionRes.json()
    const role = session?.user?.role
    const home: Record<string, string> = {
      SYSTEM_ADMIN: '/admin',
      MANAGER: '/manager',
      TRAVEL_MANAGER: '/manager',
      TRAVEL_AGENT: '/agent',
      FINANCE_ADMIN: '/finance',
    }
    router.push(home[role] ?? '/employee')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Two-factor authentication</h1>
          <p className="mt-2 text-sm text-gray-500">
            Enter the 6-digit code from your authenticator app, or one of your backup codes
          </p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Authenticator or backup code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z-]/g, ''))}
              maxLength={9}
              required
              placeholder="000000 / XXXX-XXXX"
              className="text-center text-2xl tracking-widest"
            />
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={loading}>
              Verify
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
