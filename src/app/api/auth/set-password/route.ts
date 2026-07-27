import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/tokens'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { emailInvitationAccepted } from '@/lib/mail'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  // Token-guessing protection: 30 validation attempts per IP per 15 minutes
  if (!(await rateLimit(`setpw-get:${clientIp(req)}`, 30, 15 * 60_000))) {
    return NextResponse.json({ valid: false }, { status: 429 })
  }

  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false })

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(token) },
    include: { user: { select: { name: true, company: { select: { slug: true } } } } },
  })

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ valid: false })
  }

  return NextResponse.json({ valid: true, name: record.user.name, companySlug: record.user.company.slug })
}

export async function POST(req: NextRequest) {
  // Token-guessing protection: 10 attempts per IP per 15 minutes
  if (!(await rateLimit(`setpw-post:${clientIp(req)}`, 10, 15 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const body = await req.json()
  const { token, password } = body

  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(token) },
  })

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This link has expired or already been used.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash, passwordChangedAt: new Date() },
    select: { id: true, name: true, email: true, companyId: true },
  })

  await prisma.verificationToken.delete({ where: { id: record.id } })

  if (record.type === 'INVITE') {
    const admins = await prisma.user.findMany({
      where: { companyId: user.companyId, role: { in: ['SYSTEM_ADMIN', 'FINANCE_ADMIN'] }, isActive: true },
      select: { name: true, email: true },
    })
    for (const admin of admins) {
      if (!admin.email) continue
      emailInvitationAccepted(admin.email, admin.name ?? 'there', {
        newUserName: user.name, newUserEmail: user.email, userId: user.id,
      }, user.companyId).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
