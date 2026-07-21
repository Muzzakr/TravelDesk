import type { captureRequestError } from '@sentry/nextjs'

// Server + edge runtime error monitoring. No-ops until SENTRY_DSN is set —
// see src/instrumentation-client.ts for the browser-side equivalent.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
    })
  }
}

export async function onRequestError(...args: Parameters<typeof captureRequestError>) {
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(...args)
}
