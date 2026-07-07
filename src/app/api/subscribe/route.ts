import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendNewsletterWelcomeEmail } from '@/lib/mail'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  // Public endpoint that sends email — throttle per IP
  if (!(await rateLimit(`subscribe:${clientIp(req)}`, 5, 15 * 60_000))) {
    return NextResponse.json({ message: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const { email } = await req.json().catch(() => ({ email: '' }))

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ message: 'Invalid email' }, { status: 400 })
  }
  const normalized = email.trim().toLowerCase()

  const existing = await prisma.subscriber.findUnique({ where: { email: normalized } })
  if (existing && !existing.unsubscribedAt) {
    return NextResponse.json({ message: 'Already subscribed' }, { status: 409 })
  }

  // New subscriber, or a previously unsubscribed one coming back
  await prisma.subscriber.upsert({
    where: { email: normalized },
    create: { email: normalized },
    update: { unsubscribedAt: null },
  })

  try {
    await sendNewsletterWelcomeEmail(normalized)
  } catch (err) {
    console.error('Welcome email failed:', err)
  }

  return NextResponse.json({ message: 'Subscribed successfully' }, { status: 201 })
}
