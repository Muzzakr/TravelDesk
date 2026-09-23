import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'
import { sendTestWebhookEvent } from '@/lib/webhooks'

export async function POST() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await sendTestWebhookEvent(session.user.companyId)

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'WEBHOOK_TEST_EVENT_SENT',
    entityType: 'WebhookSubscription',
    entityId: session.user.companyId,
    payload: { ok: result.ok, error: result.error },
  })

  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Delivery failed' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
