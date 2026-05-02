'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-5xl font-bold text-red-500">500</p>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Something went wrong</h1>
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-2 rounded-lg bg-red-50 p-3 text-left text-xs font-mono text-red-700 break-all">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Try again
          </button>
          <Link
            href="/login"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Go to login
          </Link>
        </div>
      </div>
    </div>
  )
}
