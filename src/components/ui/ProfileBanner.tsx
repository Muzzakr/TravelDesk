'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Props = {
  missingFields: string[]
  userId: string
  blocking?: boolean
}

export function ProfileBanner({ missingFields, userId, blocking = false }: Props) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (blocking) {
      setDismissed(false)
      return
    }
    const key = `profile-banner-dismissed-${userId}`
    const isDismissed = sessionStorage.getItem(key) === '1'
    setDismissed(isDismissed)
  }, [userId, blocking])

  function dismiss() {
    if (blocking) return
    const key = `profile-banner-dismissed-${userId}`
    sessionStorage.setItem(key, '1')
    setDismissed(true)
  }

  if (dismissed || missingFields.length === 0) return null

  return (
    <div className="mx-4 mt-4 md:mx-8 md:mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {blocking ? 'Complete your profile to continue' : 'Your travel profile is incomplete'}
          </p>
          <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
            {blocking
              ? 'Please add your contact information before using the app.'
              : 'This information is required for bookings and travel requests.'}
            {' '}Missing: <span className="font-medium">{missingFields.join(', ')}</span>.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Link
              href="/employee/profile"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              Complete profile
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            {!blocking && (
              <button
                type="button"
                onClick={dismiss}
                className="text-xs text-amber-600 hover:text-amber-800 font-medium underline underline-offset-2"
              >
                Remind me later
              </button>
            )}
          </div>
        </div>

        {!blocking && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1 text-amber-400 hover:text-amber-600 hover:bg-amber-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
