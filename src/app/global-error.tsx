'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Catches errors that escape every other error boundary (including the
// root layout itself) and reports them to Sentry before showing a
// minimal fallback. Must render its own <html>/<body> — it replaces the
// root layout when triggered.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en-US">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'sans-serif' }}>
          <div style={{ textAlign: 'center', maxWidth: '24rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Something went wrong</h1>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
              An unexpected error occurred. The team has been notified.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ borderRadius: '0.75rem', backgroundColor: '#4f46e5', color: 'white', padding: '0.625rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
