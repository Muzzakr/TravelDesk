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

  for (const user of users) {
    try {
      const rawToken = await createVerificationToken(user.id, 'MAGIC_LINK')
      await sendMagicLinkEmail(user.email, user.name, rawToken, user.company.name)
    } catch (err) {
      console.error('Magic link email failed:', err)
    }
  }

  // Always the same response — never reveal whether the email exists
  return NextResponse.json({ ok: true })
}
