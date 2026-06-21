'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

const GOOGLE_BANNERS: Record<string, { color: string; msg: string }> = {
  pending:  { color: 'bg-blue-50 text-blue-800 border-blue-200',   msg: 'Check your email — click the link to confirm your Google login.' },
  verified: { color: 'bg-green-50 text-green-800 border-green-200', msg: 'Google login confirmed! Click "Sign in with Google" below to continue.' },
  notfound: { color: 'bg-red-50 text-red-800 border-red-200',       msg: 'No M4U Travel account found for that Google address. Contact your admin.' },
  expired:  { color: 'bg-amber-50 text-amber-800 border-amber-200', msg: 'Verification link expired. Please click "Sign in with Google" to try again.' },
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    companySlug: params.get('company') ?? '',
    email: '',
    password: '',
  })

  const googleParam = params.get('google') ?? ''
  const googleBanner = GOOGLE_BANNERS[googleParam]

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email: form.email,
      password: form.password,
      companySlug: form.companySlug,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid credentials. Please check your company slug, email and password.')
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

  async function handleGoogle() {
    setGoogleLoading(true)
    await signIn('google', { callbackUrl: '/login' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">M4U Travel</h1>
          <p className="mt-2 text-gray-500">Sign in to your account</p>
        </div>

        {params.get('registered') && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Account created! Please sign in.
          </div>
        )}
        {params.get('message') === 'password-set' && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Password set successfully. You can now sign in.
          </div>
        )}
        {googleBanner && (
          <div className={`mb-4 rounded-lg border p-3 text-sm ${googleBanner.color}`}>
            {googleBanner.msg}
          </div>
        )}

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Company"
              name="companySlug"
              value={form.companySlug}
              onChange={handleChange}
              required
              placeholder="acme-corp"
              hint="Your company's slug"
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="you@company.com"
            />
            <Input
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
            />
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={loading} className="mt-2">
              Sign in
            </Button>
            <p className="text-center text-sm text-gray-500">
              <Link href="/forgot-password" className="font-medium text-indigo-600 hover:underline">
                Forgot your password?
              </Link>
            </p>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
          </button>

          <p className="mt-6 text-center text-sm text-gray-500">
            New company?{' '}
            <Link href="/signup" className="font-medium text-indigo-600 hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
