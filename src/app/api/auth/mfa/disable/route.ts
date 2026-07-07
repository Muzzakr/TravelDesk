import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { authenticator } from 'otplib'
import { NextRequest, NextResponse } from 'next/server'
import { consumeBackupCode, deleteBackupCodes } from '@/lib/mfa-backup'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await rateLimit(`mfa-disable:${clientIp(req)}`, 10, 15 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const { code, password } = await req.json()
  if (!code) return NextResponse.json({ error: 'Confirmation code required' }, { status: 400 })
  // Password re-entry stops a hijacked session from silently turning MFA off
  if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mfaSecret: true, mfaEnabled: true, passwordHash: true },
  })

  if (!user?.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 })
  }

  if (!user.passwordHash || !(await bcrypt.compare(String(password), user.passwordHash))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 400 })
  }

  const normalized = String(code).replace(/\s/g, '')
  const isValid =
    authenticator.verify({ token: normalized, secret: user.mfaSecret }) ||
    (await consumeBackupCode(session.user.id, normalized))
  if (!isValid) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  })
  await deleteBackupCodes(session.user.id)

  return NextResponse.json({ ok: true })
}
