import { NextRequest, NextResponse } from 'next/server'
import * as client from 'openid-client'
import { prisma } from '@/lib/prisma'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getOidcClient } from '@/lib/sso/oidc-client'

const APP_URL = (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? '').replace(/\/+$/, '')

// Starts the OIDC authorization-code flow for a company's own IdP. The
// state/nonce/PKCE verifier are stored in a short-lived HttpOnly cookie, not
// just signed into the state value — the callback verifies the incoming
// state against this cookie, so a validly-signed-but-unbound state can't be
// replayed (login-CSRF). See src/lib/sso/oidc-client.ts for the discovery
// call this depends on.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('company')
  if (!slug) return NextResponse.redirect(new URL('/login?sso=disabled', req.url))

  if (!(await rateLimit(`sso-authorize:${clientIp(req)}:${slug}`, 10, 15 * 60_000))) {
    return NextResponse.redirect(new URL('/login?sso=disabled', req.url))
  }

  const company = await prisma.company.findUnique({ where: { slug } })
  if (!company) return NextResponse.redirect(new URL('/login?sso=disabled', req.url))

  const config = await prisma.companySsoConfig.findUnique({ where: { companyId: company.id } })
  if (!config?.enabled) return NextResponse.redirect(new URL('/login?sso=disabled', req.url))

  let oidcConfig: client.Configuration
  try {
    oidcConfig = await getOidcClient(config)
  } catch (err) {
    console.error('SSO discovery failed:', err)
    return NextResponse.redirect(new URL('/login?sso=disabled', req.url))
  }

  const state = client.randomState()
  const nonce = client.randomNonce()
  const pkceVerifier = client.randomPKCECodeVerifier()
  const codeChallenge = await client.calculatePKCECodeChallenge(pkceVerifier)

  const authUrl = client.buildAuthorizationUrl(oidcConfig, {
    redirect_uri: `${APP_URL}/api/auth/sso/callback`,
    scope: config.scopes,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const res = NextResponse.redirect(authUrl)
  res.cookies.set(
    'sso_flow',
    JSON.stringify({ state, nonce, pkceVerifier, companyId: company.id }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/api/auth/sso',
    }
  )
  return res
}
