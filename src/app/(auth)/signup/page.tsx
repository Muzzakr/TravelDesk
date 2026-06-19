'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    companyName: '',
    companySlug: '',
    adminName: '',
    adminEmail: '',
    password: '',
    confirmPassword: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'companyName'
        ? { companySlug: value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }
        : {}),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/companies/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName,
          companySlug: form.companySlug,
          adminName: form.adminName,
          adminEmail: form.adminEmail,
          password: form.password,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = (data as { error?: unknown }).error
        let message = 'Signup failed. Please try again.'
        if (typeof err === 'string') {
          message = err
        } else if (err && typeof err === 'object' && 'fieldErrors' in err) {
          // zod flatten(): { formErrors: [], fieldErrors: { field: [msg] } }
          const msgs = Object.values((err as { fieldErrors: Record<string, string[]> }).fieldErrors).flat()
          if (msgs.length) message = msgs.join(', ')
        }
        setError(message)
        return
      }
      router.push(`/login?company=${form.companySlug}&registered=1`)
    } catch {
      setError('Could not reach the server. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">TravelDesk</h1>
          <p className="mt-2 text-gray-500">Create your company account</p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Company name"
              name="companyName"
              value={form.companyName}
              onChange={handleChange}
              required
              placeholder="Acme Corp"
            />
            <Input
              label="Company slug"
              name="companySlug"
              value={form.companySlug}
              onChange={handleChange}
              required
              placeholder="acme-corp"
              hint="Used for login URL — lowercase, hyphens only"
            />
            <Input
              label="Your name"
              name="adminName"
              value={form.adminName}
              onChange={handleChange}
              required
              placeholder="Alice Admin"
            />
            <Input
              label="Admin email"
              name="adminEmail"
              type="email"
              value={form.adminEmail}
              onChange={handleChange}
              required
              placeholder="alice@acme.com"
            />
            <Input
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="Min 8 characters"
            />
            <Input
              label="Confirm password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Re-enter password"
            />
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={loading} className="mt-2">
              Create account
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
