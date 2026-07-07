import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { authenticator } from 'otplib'
import { NextRequest, NextResponse } from 'next/server'
import { signMfaCookie } from '@/lib/mfa-cookie'
import { consumeBackupCode } from '@/lib/mfa-backup'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Code-guessing protection: 10 attempts per IP per 15 minutes
  if (!(await rateLimit(`mfa-verify:${clientIp(req)}`, 10, 15 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const body = await req.json()
  const code = String(body.code ?? '').replace(/\s/g, '')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mfaSecret: true, mfaEnabled: true },
  })

  if (!user?.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: 'MFA not enabled' }, { status: 400 })
  }

  // Accept a TOTP code, or fall back to a one-time backup code
  const isValid =
    authenticator.verify({ token: code, secret: user.mfaSecret }) ||
    (await consumeBackupCode(session.user.id, code))
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  const cookieValue = await signMfaCookie(session.user.id)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('mfa_verified', cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60,
    path: '/',
  })
  return res
}
