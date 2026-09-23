import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { encryptSecret } from '@/lib/crypto/secret-box'
import { isValidIssuer } from '@/lib/sso/oidc-client'

const PatchSchema = z.object({
  enabled: z.boolean(),
  enforced: z.boolean(),
  issuer: z.string().min(1).max(500),
  clientId: z.string().min(1).max(255),
  clientSecret: z.string().max(2000).optional(), // blank = keep existing
  scopes: z.string().min(1).max(255),
  jitProvisioningEnabled: z.boolean(),
  allowedDomain: z.string().max(255).optional().nullable(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const config = await prisma.companySsoConfig.findUnique({ where: { companyId: session.user.companyId } })
  if (!config) {
    return NextResponse.json({
      enabled: false,
      enforced: false,
      issuer: '',
      clientId: '',
      scopes: 'openid email profile',
      jitProvisioningEnabled: false,
      allowedDomain: '',
      hasClientSecret: false,
    })
  }

  // Never return the decrypted secret, or even a masked fragment — a third
  // party's client secret is more sensitive than the self-generated webhook
  // key this file family usually masks-and-shows.
  return NextResponse.json({
    enabled: config.enabled,
    enforced: config.enforced,
    issuer: config.issuer,
    clientId: config.clientId,
    scopes: config.scopes,
    jitProvisioningEnabled: config.jitProvisioningEnabled,
    allowedDomain: config.allowedDomain ?? '',
    hasClientSecret: !!config.clientSecretEnc,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  const allowedDomain = data.allowedDomain?.trim().toLowerCase() || null

  // Server-side, not just UI-side — the JIT guardrail must hold even if the
  // admin UI is bypassed. A JIT-created user gets no manager, so an
  // unrestricted domain would silently create accounts approval routing
  // can't handle.
  if (data.jitProvisioningEnabled && !allowedDomain) {
    return NextResponse.json({ error: 'An allowed email domain is required to enable JIT provisioning' }, { status: 400 })
  }
  if (data.enforced && !data.enabled) {
    return NextResponse.json({ error: 'SSO must be enabled before it can be enforced' }, { status: 400 })
  }

  const issuer = data.issuer.trim()
  if (data.enabled && !isValidIssuer(issuer)) {
    return NextResponse.json({ error: 'Issuer must be a valid https:// URL' }, { status: 400 })
  }

  const existing = await prisma.companySsoConfig.findUnique({ where: { companyId: session.user.companyId } })

  const clientSecretEnc = data.clientSecret ? encryptSecret(data.clientSecret) : existing?.clientSecretEnc
  if (!clientSecretEnc) {
    return NextResponse.json({ error: 'Client secret is required' }, { status: 400 })
  }

  const config = await prisma.companySsoConfig.upsert({
    where: { companyId: session.user.companyId },
    create: {
      companyId: session.user.companyId,
      issuer,
      clientId: data.clientId.trim(),
      clientSecretEnc,
      scopes: data.scopes.trim(),
      enabled: data.enabled,
      enforced: data.enforced,
      jitProvisioningEnabled: data.jitProvisioningEnabled,
      allowedDomain,
    },
    update: {
      issuer,
      clientId: data.clientId.trim(),
      clientSecretEnc,
      scopes: data.scopes.trim(),
      enabled: data.enabled,
      enforced: data.enforced,
      jitProvisioningEnabled: data.jitProvisioningEnabled,
      allowedDomain,
    },
  })

  return NextResponse.json({
    enabled: config.enabled,
    enforced: config.enforced,
    issuer: config.issuer,
    clientId: config.clientId,
    scopes: config.scopes,
    jitProvisioningEnabled: config.jitProvisioningEnabled,
    allowedDomain: config.allowedDomain ?? '',
    hasClientSecret: true,
  })
}
