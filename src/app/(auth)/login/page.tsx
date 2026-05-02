'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    companySlug: params.get('company') ?? '',
    email: '',
    password: '',
  })

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
      TRAVEL_AGENT: '/agent',
      FINANCE_ADMIN: '/finance',
    }
    router.push(home[role] ?? '/employee')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">TravelDesk</h1>
          <p className="mt-2 text-gray-500">Sign in to your account</p>
        </div>
        {params.get('registered') && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Account created! Please sign in.
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
          </form>
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
