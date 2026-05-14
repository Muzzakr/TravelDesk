import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createVerificationToken } from '@/lib/tokens'
import { sendPasswordResetEmail } from '@/lib/mail'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const email = (body.email ?? '').trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ ok: true })
  }

  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
  })

  if (user) {
    try {
      const rawToken = await createVerificationToken(user.id, 'PASSWORD_RESET')
      await sendPasswordResetEmail(user.email, user.name, rawToken)
    } catch (err) {
      console.error('Failed to send password reset email:', err)
    }
  }

  // Always return 200 — never reveal whether the email exists
  return NextResponse.json({ ok: true })
}
