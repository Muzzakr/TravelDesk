const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    // Profile/passport/driver's-license photos are served from signed
    // Supabase Storage URLs. The project ref subdomain changes whenever
    // the Supabase project changes (e.g. moving to a new project), so
    // this allows any *.supabase.co host rather than a hardcoded one.
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
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
