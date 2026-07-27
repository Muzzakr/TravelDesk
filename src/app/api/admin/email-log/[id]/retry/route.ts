import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { attemptSend } from '@/lib/email'
import { writeAuditLog } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const log = await prisma.emailLog.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await attemptSend(params.id)

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'EMAIL_RETRIED',
    entityType: 'EmailLog',
    entityId: params.id,
    payload: { type: log.type, result: result.status },
  })

  return NextResponse.json(result)
}
