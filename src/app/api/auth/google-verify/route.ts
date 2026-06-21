import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/tokens'

export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get('token')
  if (!raw) return NextResponse.redirect(new URL('/login?google=expired', req.url))

  const hashed = hashToken(raw)
  const record = await prisma.verificationToken.findFirst({
    where: { token: hashed, type: 'GOOGLE_VERIFY', expiresAt: { gt: new Date() } },
  })
  if (!record) return NextResponse.redirect(new URL('/login?google=expired', req.url))

  await prisma.user.update({
    where: { id: record.userId },
    data: { googleVerified: true },
  })
  await prisma.verificationToken.delete({ where: { id: record.id } })

  return NextResponse.redirect(new URL('/login?google=verified', req.url))
}
