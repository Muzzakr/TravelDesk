import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { attemptWebhookDelivery } from '@/lib/webhooks'

const MAX_ATTEMPTS = 5

// Sweeps failed WebhookDelivery rows and retries them. Runs every 30 minutes
// (see vercel.json) — the same auth pattern as the other crons in this app.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const failed = await prisma.webhookDelivery.findMany({
    where: { status: 'FAILED', attempts: { lt: MAX_ATTEMPTS } },
    select: { id: true },
    take: 200,
  })

  let retried = 0
  let sent = 0
  for (const row of failed) {
    const result = await attemptWebhookDelivery(row.id)
    retried++
    if (result.status === 'SENT') sent++
  }

  return NextResponse.json({ success: true, retried, sent })
}
