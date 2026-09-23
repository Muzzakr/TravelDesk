import crypto from 'crypto'
import { prisma } from './prisma'

export type WebhookEventType = 'travel_request.approved' | 'expense.paid'

interface DispatchParams {
  companyId: string
  eventType: WebhookEventType
  relatedEntityType: string
  relatedEntityId: string
  data: Record<string, unknown>
}

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

// Fire-and-forget outbound webhook dispatch. Mirrors createNotification:
// a failure here (no subscription, bad secret, DB error) must never block
// the underlying business action (approval, payout, etc.).
export async function dispatchWebhookEvent(params: DispatchParams): Promise<void> {
  try {
    const sub = await prisma.webhookSubscription.findUnique({ where: { companyId: params.companyId } })
    if (!sub || !sub.isActive || !sub.url || !sub.secret) return
    if (!sub.eventTypes.includes(params.eventType)) return

    const payload = JSON.stringify({
      id: crypto.randomUUID(),
      type: params.eventType,
      createdAt: new Date().toISOString(),
      data: params.data,
    })

    const delivery = await prisma.webhookDelivery.create({
      data: {
        companyId: params.companyId,
        eventType: params.eventType,
        url: sub.url,
        payload,
        signature: sign(payload, sub.secret),
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
      },
    })

    await attemptWebhookDelivery(delivery.id)
  } catch (err) {
    console.error('dispatchWebhookEvent failed:', err)
  }
}

const TIMEOUT_MS = 10_000

// Shared by first-attempt dispatch and the retry cron — always sends the
// bytes already stored on the row, never re-derives payload from live data,
// so a retry's signature always matches what was originally computed.
export async function attemptWebhookDelivery(deliveryId: string): Promise<{ status: 'SENT' | 'FAILED' }> {
  const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } })
  if (!delivery) return { status: 'FAILED' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(delivery.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': delivery.signature,
        'X-Webhook-Event': delivery.eventType,
        'X-Webhook-Id': delivery.id,
      },
      body: delivery.payload,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Non-2xx response: ${res.status}`)

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, errorMessage: null },
    })
    return { status: 'SENT' }
  } catch (err) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'FAILED',
        errorMessage: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        attempts: { increment: 1 },
      },
    })
    return { status: 'FAILED' }
  } finally {
    clearTimeout(timer)
  }
}

// Sends a synthetic test payload so admins can validate URL/secret setup
// before relying on it; still logged to WebhookDelivery for visibility.
export async function sendTestWebhookEvent(companyId: string): Promise<{ ok: boolean; error?: string }> {
  const sub = await prisma.webhookSubscription.findUnique({ where: { companyId } })
  if (!sub || !sub.url || !sub.secret) return { ok: false, error: 'No webhook URL/secret configured yet' }

  const payload = JSON.stringify({
    id: crypto.randomUUID(),
    type: 'webhook.test',
    createdAt: new Date().toISOString(),
    data: { message: 'This is a test event from TravelDesk' },
  })
  const signature = sign(payload, sub.secret)

  const delivery = await prisma.webhookDelivery.create({
    data: {
      companyId,
      eventType: 'webhook.test',
      url: sub.url,
      payload,
      signature,
      relatedEntityType: null,
      relatedEntityId: null,
    },
  })

  const result = await attemptWebhookDelivery(delivery.id)
  if (result.status === 'SENT') return { ok: true }
  const updated = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } })
  return { ok: false, error: updated?.errorMessage ?? 'Delivery failed' }
}
