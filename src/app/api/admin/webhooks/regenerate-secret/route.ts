import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import crypto from 'crypto'

export async function POST() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const newSecret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`

  await prisma.webhookSubscription.upsert({
    where: { companyId: session.user.companyId },
    update: { secret: newSecret },
    create: { companyId: session.user.companyId, secret: newSecret },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'WEBHOOK_SECRET_REGENERATED',
    entityType: 'WebhookSubscription',
    entityId: session.user.companyId,
    payload: {},
  })

  return NextResponse.json({ secret: newSecret })
}
