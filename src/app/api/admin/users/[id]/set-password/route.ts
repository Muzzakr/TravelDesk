import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const Schema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = await prisma.user.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const hash = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({ where: { id: params.id }, data: { passwordHash: hash } })

  // Invalidate any pending invite/reset tokens for this user
  await prisma.verificationToken.deleteMany({ where: { userId: params.id } })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'ADMIN_PASSWORD_RESET',
    entityType: 'User',
    entityId: params.id,
    payload: { targetUser: user.email },
  })

  return NextResponse.json({ ok: true })
}
