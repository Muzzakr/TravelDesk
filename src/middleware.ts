import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { Role } from '@/types/user'
import { verifyMfaCookie } from '@/lib/mfa-cookie'

const PUBLIC_PATHS = ['/login', '/signup', '/api/auth', '/api/companies/signup', '/set-password', '/forgot-password']

const ROLE_PATHS: Record<string, Role[]> = {
  '/employee': ['EMPLOYEE', 'MANAGER', 'FINANCE_ADMIN', 'SYSTEM_ADMIN'],
  '/manager': ['MANAGER', 'FINANCE_ADMIN', 'SYSTEM_ADMIN'],
  '/agent': ['TRAVEL_AGENT', 'SYSTEM_ADMIN'],
  '/finance': ['FINANCE_ADMIN', 'SYSTEM_ADMIN'],
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
    if (!mfaOk && pathname !== '/auth/mfa') {
      return NextResponse.redirect(new URL('/auth/mfa', req.url))
    }
  }

  // RBAC gate
  for (const [path, allowedRoles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(path)) {
      if (!role || !allowedRoles.includes(role)) {
        return NextResponse.redirect(new URL('/employee', req.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
