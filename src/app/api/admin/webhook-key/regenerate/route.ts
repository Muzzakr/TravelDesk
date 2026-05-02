import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

export async function POST() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const newKey = `wh_${crypto.randomUUID().replace(/-/g, '')}`

  await prisma.company.update({
    where: { id: session.user.companyId },
    data: { webhookApiKey: newKey },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'WEBHOOK_KEY_REGENERATED',
    entityType: 'Company',
    entityId: session.user.companyId,
    payload: {},
  })

  return NextResponse.json({ key: newKey })
}
