'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading')
  const [name, setName] = useState('')
  const [companySlug, setCompanySlug] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    fetch(`/api/auth/set-password?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) { setName(d.name); setCompanySlug(d.companySlug ?? ''); setStatus('valid') }
        else setStatus('invalid')
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    if (res.ok) {
      router.push(`/login?message=password-set${companySlug ? `&company=${companySlug}` : ''}`)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong. Please request a new invite.')
    }
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">M4U Travel</h1>
          <p className="mt-2 text-gray-500">Set your password</p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          {status === 'loading' && (
            <p className="text-center text-sm text-gray-400">Verifying link…</p>
          )}

          {status === 'invalid' && (
            <div className="text-center space-y-3">
              <p className="text-sm text-red-600 font-medium">This link has expired or already been used.</p>
              <p className="text-sm text-gray-500">Please contact your administrator to request a new invite, or use &quot;Forgot password&quot; on the login page.</p>
              <a href="/login" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
                Back to login →
              </a>
            </div>
          )}

          {status === 'valid' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {name && <p className="text-sm text-gray-600">Hi <strong>{name}</strong>, choose a password for your account.</p>}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">New password</label>
                <input
                  type="password"
                  title="New password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Confirm password</label>
                <input
                  type="password"
                  title="Confirm password"
                  required
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="mt-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Set password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  )
}
