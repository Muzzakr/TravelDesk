import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { authenticator } from 'otplib'
import { toDataURL } from 'qrcode'
import { NextRequest, NextResponse } from 'next/server'
import { generateBackupCodes } from '@/lib/mfa-backup'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, mfaEnabled: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.mfaEnabled) return NextResponse.json({ error: 'MFA already enabled' }, { status: 400 })

  const secret = authenticator.generateSecret()
  const otpauth = authenticator.keyuri(user.email, 'M4U Travel', secret)
  const qrCode = await toDataURL(otpauth)

  // Store temp secret in DB (user confirms with code before we mark mfaEnabled)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { mfaSecret: secret },
  })

  return NextResponse.json({ secret, qrCode })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const code = String(body.code ?? '').replace(/\s/g, '')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mfaSecret: true },
  })
  if (!user?.mfaSecret) {
    return NextResponse.json({ error: 'Run GET /api/auth/mfa/setup first' }, { status: 400 })
  }

  const isValid = authenticator.verify({ token: code, secret: user.mfaSecret })
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: true },
  })

  // One-time recovery codes — returned exactly once, only hashes are stored
  const backupCodes = await generateBackupCodes(session.user.id)

  return NextResponse.json({ ok: true, backupCodes })
}
