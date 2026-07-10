import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { Role } from '@/types/user'
import { verifyMfaCookie } from '@/lib/mfa-cookie'

// /api/cron and /api/webhooks authenticate themselves (CRON_SECRET / HMAC
// signatures) — they must bypass the session redirect or Vercel cron and
// Slack/card-feed webhooks can never reach them.
const PUBLIC_PATHS = ['/login', '/signup', '/api/auth', '/api/companies/signup', '/set-password', '/forgot-password', '/magic-link', '/api/contact', '/api/subscribe', '/api/unsubscribe', '/api/cron', '/api/webhooks']

const ROLE_PATHS: Record<string, Role[]> = {
  '/employee': ['EMPLOYEE', 'MANAGER', 'TRAVEL_MANAGER', 'FINANCE_ADMIN', 'SYSTEM_ADMIN'],
  '/manager': ['MANAGER', 'TRAVEL_MANAGER', 'FINANCE_ADMIN', 'SYSTEM_ADMIN'],
  '/agent': ['TRAVEL_AGENT', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'],
  '/finance': ['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'],
  '/admin/stats': ['SYSTEM_ADMIN', 'MANAGER', 'TRAVEL_MANAGER'],
  '/admin': ['SYSTEM_ADMIN'],
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/' || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // In production (HTTPS) Auth.js prefixes the session cookie with `__Secure-`.
  // Match it, otherwise the token is never found and every request loops to /login.
  const secureCookie = process.env.NODE_ENV === 'production'
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '',
    secureCookie,
    cookieName: secureCookie ? '__Secure-authjs.session-token' : 'authjs.session-token',
  })

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const role = token.role as Role | undefined
  const mfaEnabled = token.mfaEnabled as boolean | undefined
  const mfaVerified = token.mfaVerified as boolean | undefined
  const userId = token.id as string | undefined ?? ''

  // MFA gate: check JWT flag OR HMAC-signed mfa_verified cookie
  if (mfaEnabled) {
    const mfaCookie = req.cookies.get('mfa_verified')?.value
    const cookieValid = mfaCookie ? await verifyMfaCookie(mfaCookie, userId) : false
    const mfaOk = mfaVerified || cookieValid
    if (!mfaOk && pathname !== '/mfa') {
      return NextResponse.redirect(new URL('/mfa', req.url))
    }
  }

  // RBAC gate — only the most specific (longest) matching prefix applies,
  // so '/admin/stats' can be more permissive than '/admin'.
  const matchedPath = Object.keys(ROLE_PATHS)
    .filter((p) => pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0]
  if (matchedPath) {
    const allowedRoles = ROLE_PATHS[matchedPath]
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.redirect(new URL('/employee', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
