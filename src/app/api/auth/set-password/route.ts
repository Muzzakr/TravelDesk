import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/tokens'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false })

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(token) },
    include: { user: { select: { name: true } } },
  })

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ valid: false })
  }

  return NextResponse.json({ valid: true, name: record.user.name })
}

export async function POST(req: NextRequest) {
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

  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash },
  })

  await prisma.verificationToken.delete({ where: { id: record.id } })

  return NextResponse.json({ ok: true })
}
