import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { authenticator } from 'otplib'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Confirmation code required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mfaSecret: true, mfaEnabled: true },
  })

  if (!user?.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 })
  }

  const isValid = authenticator.verify({ token: String(code).replace(/\s/g, ''), secret: user.mfaSecret })
  if (!isValid) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  })

  return NextResponse.json({ ok: true })
}
