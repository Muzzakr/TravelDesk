'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'

function MagicLinkContent() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (!token) { router.replace('/login?magic=expired'); return }

    ;(async () => {
      const result = await signIn('magic-link', { token, redirect: false })
      if (result?.error) {
        router.replace('/login?magic=expired')
        return
      }
      // Same role → home map as the login page
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
      router.replace(home[role] ?? '/employee')
    })()
  }, [token, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-gray-900">M4U Travel</h1>
        <div className="mt-6 rounded-2xl bg-white p-8 shadow-lg">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" aria-hidden="true" />
          <p className="mt-4 text-sm text-gray-600">Signing you in…</p>
        </div>
      </div>
    </div>
  )
}

export default function MagicLinkPage() {
  return (
    <Suspense>
      <MagicLinkContent />
    </Suspense>
  )
}
