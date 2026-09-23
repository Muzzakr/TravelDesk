import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const PatchSchema = z.object({
  url: z.string().url().nullable(),
  eventTypes: z.array(z.enum(['travel_request.approved', 'expense.paid'])),
  isActive: z.boolean(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sub = await prisma.webhookSubscription.findUnique({ where: { companyId: session.user.companyId } })

  return NextResponse.json({
    url: sub?.url ?? null,
    isActive: sub?.isActive ?? true,
    eventTypes: sub?.eventTypes ?? [],
    hasSecret: !!sub?.secret,
    secretMasked: sub?.secret ? `••••••••••••${sub.secret.slice(-8)}` : null,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const sub = await prisma.webhookSubscription.upsert({
    where: { companyId: session.user.companyId },
    update: { url: parsed.data.url, eventTypes: parsed.data.eventTypes, isActive: parsed.data.isActive },
    create: {
      companyId: session.user.companyId,
      url: parsed.data.url,
      eventTypes: parsed.data.eventTypes,
      isActive: parsed.data.isActive,
    },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'WEBHOOK_SUBSCRIPTION_UPDATED',
    entityType: 'WebhookSubscription',
    entityId: sub.id,
    payload: { url: parsed.data.url, eventTypes: parsed.data.eventTypes, isActive: parsed.data.isActive },
  })

  return NextResponse.json({ ok: true })
}
