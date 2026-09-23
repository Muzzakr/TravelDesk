import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createVerificationToken } from '@/lib/tokens'
import { sendMagicLinkEmail } from '@/lib/mail'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  // Email-bombing protection: 5 link requests per IP per 15 minutes
  if (!(await rateLimit(`magic:${clientIp(req)}`, 5, 15 * 60_000))) {
    return NextResponse.json({ ok: true })
  }

  const { email } = await req.json().catch(() => ({ email: '' }))
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ ok: true })
  }
  const normalized = email.trim().toLowerCase()

  // The same email can exist in several companies — send one link per
  // account, each tied to its own userId and labelled with the company.
  const users = await prisma.user.findMany({
    where: { email: normalized, isActive: true },
    include: { company: { select: { name: true } } },
  })

  // Companies that enforce SSO don't allow any password-free bypass either —
  // magic-link is still a non-SSO login path, so it's gated the same way the
  // credentials and Google providers are in src/lib/auth.ts.
  const companyIds = [...new Set(users.map((u) => u.companyId))]
  const enforcedConfigs = companyIds.length
    ? await prisma.companySsoConfig.findMany({
        where: { companyId: { in: companyIds }, enforced: true },
        select: { companyId: true },
      })
    : []
  const enforcedCompanyIds = new Set(enforcedConfigs.map((c) => c.companyId))

  let failed = 0
  for (const user of users) {
    if (enforcedCompanyIds.has(user.companyId)) continue
    try {
      const rawToken = await createVerificationToken(user.id, 'MAGIC_LINK')
      await sendMagicLinkEmail(user.email, user.name, rawToken, user.company.name, user.companyId)
    } catch (err) {
      console.error('Magic link email failed:', err)
      failed++
    }
  }

  // A server-side send failure must not masquerade as success — the user
  // would wait for an email that never comes. (Unknown emails still get
  // the ok response below, so account existence is never revealed.)
  if (users.length > 0 && failed === users.length) {
    return NextResponse.json({ error: 'Could not send the email right now. Please try again in a moment.' }, { status: 500 })
  }

  // Always the same response — never reveal whether the email exists
  return NextResponse.json({ ok: true })
}
