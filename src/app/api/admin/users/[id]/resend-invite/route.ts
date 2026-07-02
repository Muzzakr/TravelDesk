import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { createVerificationToken } from '@/lib/tokens'
import { sendInviteEmail } from '@/lib/mail'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await prisma.user.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { slug: true },
  })
  const rawToken = await createVerificationToken(user.id, 'INVITE')
  const setPasswordUrl = `${process.env.APP_URL ?? ''}/set-password?token=${rawToken}`

  let emailSent = false
  try {
    await sendInviteEmail(user.email, user.name, rawToken, company?.slug)
    emailSent = true
  } catch (err) {
    console.error('Resend invite email failed:', err)
  }

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'INVITE_RESENT',
    entityType: 'User',
    entityId: user.id,
    payload: { targetUser: user.email, emailSent },
  })

  return NextResponse.json({ ok: true, emailSent, setPasswordUrl })
}
