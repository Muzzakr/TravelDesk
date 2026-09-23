import { NextRequest, NextResponse } from 'next/server'
import * as client from 'openid-client'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { getOidcClient } from '@/lib/sso/oidc-client'
import { createVerificationToken } from '@/lib/tokens'
import { writeAuditLog } from '@/lib/audit'
import { checkNewDevice } from '@/lib/device'

interface SsoFlowCookie {
  state: string
  nonce: string
  pkceVerifier: string
  companyId: string
}

function fail(req: NextRequest, reason: string) {
  const res = NextResponse.redirect(new URL(`/login?sso=${reason}`, req.url))
  res.cookies.delete({ name: 'sso_flow', path: '/api/auth/sso' })
  return res
}

// Completes the OIDC authorization-code flow started by
// /api/auth/sso/authorize. Never forwards the IdP's own error/error_description
// into a redirect — those are logged server-side only, since they can contain
// details we don't want echoed back into a URL a user might screenshot/share.
export async function GET(req: NextRequest) {
  const idpError = req.nextUrl.searchParams.get('error')
  if (idpError) {
    console.error('SSO callback: IdP returned an error:', idpError, req.nextUrl.searchParams.get('error_description'))
    return fail(req, 'notfound')
  }

  const rawCookie = req.cookies.get('sso_flow')?.value
  if (!rawCookie) return fail(req, 'expired')

  let flow: SsoFlowCookie
  try {
    flow = JSON.parse(rawCookie)
  } catch {
    return fail(req, 'expired')
  }

  const config = await prisma.companySsoConfig.findUnique({ where: { companyId: flow.companyId } })
  if (!config?.enabled) return fail(req, 'disabled')

  let oidcConfig: client.Configuration
  try {
    oidcConfig = await getOidcClient(config)
  } catch (err) {
    console.error('SSO discovery failed:', err)
    return fail(req, 'notfound')
  }

  let claims: client.IDToken | undefined
  try {
    const tokens = await client.authorizationCodeGrant(oidcConfig, new URL(req.url), {
      expectedState: flow.state,
      expectedNonce: flow.nonce,
      pkceCodeVerifier: flow.pkceVerifier,
    })
    claims = tokens.claims()
  } catch (err) {
    console.error('SSO token exchange failed:', err)
    return fail(req, 'notfound')
  }

  if (!claims) return fail(req, 'notfound')

  // Optional per spec, but if the IdP does assert it, it must be true —
  // mirrors the existing Google signIn callback's exact check in auth.ts.
  if (claims.email_verified !== undefined && claims.email_verified !== true) {
    return fail(req, 'notfound')
  }

  const email = typeof claims.email === 'string' ? claims.email : undefined
  if (!email) return fail(req, 'notfound')

  let user = await prisma.user.findUnique({
    where: { companyId_email: { companyId: config.companyId, email } },
  })

  if (user && !user.isActive) return fail(req, 'notfound')

  if (!user) {
    const domain = email.split('@')[1]?.toLowerCase()
    const eligible =
      config.jitProvisioningEnabled &&
      !!config.allowedDomain &&
      domain === config.allowedDomain.toLowerCase()

    if (!eligible) return fail(req, 'notfound')
    if (!(await rateLimit(`sso-jit:${config.companyId}`, 20, 60 * 60_000))) return fail(req, 'notfound')

    const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name : email

    user = await prisma.user.create({
      data: {
        companyId: config.companyId,
        email,
        name,
        role: 'EMPLOYEE',
        isActive: true,
      },
    })

    try {
      await writeAuditLog({
        companyId: user.companyId,
        actorId: user.id,
        action: 'SSO_JIT_PROVISIONED',
        entityType: 'User',
        entityId: user.id,
        payload: { email: user.email, allowedDomain: config.allowedDomain },
      })
    } catch (err) {
      console.error('Audit log failed:', err)
    }
  }

  const raw = await createVerificationToken(user.id, 'SSO_SESSION')
  await checkNewDevice(user.id, user.companyId, user.name, user.email, req)

  const res = NextResponse.redirect(new URL(`/sso/complete?token=${raw}`, req.url))
  res.cookies.delete({ name: 'sso_flow', path: '/api/auth/sso' })
  return res
}
