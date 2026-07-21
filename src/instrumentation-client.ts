import * as Sentry from '@sentry/nextjs'

// Browser-side error monitoring. No-ops until NEXT_PUBLIC_SENTRY_DSN is
// set — DSNs are not secret (they're shipped in client JS by design), so
// the same value works for both this file and src/instrumentation.ts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
