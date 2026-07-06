import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createVerificationToken } from '@/lib/tokens'
import { sendPasswordResetEmail } from '@/lib/mail'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Email-bombing protection: 5 reset requests per IP per 15 minutes
  if (!(await rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60_000))) {
    return NextResponse.json({ ok: true })
  }

  const body = await req.json()
  const email = (body.email ?? '').trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ ok: true })
  }

  // The same email can exist in several companies — send one reset email per
  // account (named per company) so every account can be recovered.
  const users = await prisma.user.findMany({
    where: { email, isActive: true },
    include: { company: { select: { name: true } } },
  })

  for (const user of users) {
    try {
      const rawToken = await createVerificationToken(user.id, 'PASSWORD_RESET')
      await sendPasswordResetEmail(user.email, user.name, rawToken, user.company.name)
    } catch (err) {
      console.error('Failed to send password reset email:', err)
    }
  }

  // Always return 200 — never reveal whether the email exists
  return NextResponse.json({ ok: true })
}
