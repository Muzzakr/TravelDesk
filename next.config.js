const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

// Source-map upload (for readable stack traces in Sentry) only runs when
// SENTRY_AUTH_TOKEN is set — harmless no-op build-time skip otherwise, so
// this is safe to ship before Sentry is fully configured.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  disableLogger: true,
  widenClientFileUpload: true,
  automaticVercelMonitors: true,
})
