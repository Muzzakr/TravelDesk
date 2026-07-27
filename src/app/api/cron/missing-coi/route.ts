import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailMissingCoi } from '@/lib/mail'

const LOOKAHEAD_DAYS = 14

// Daily check: ACTIVE events happening within the next 14 days that have no
// COI document on file yet get a reminder emailed to their owner.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000)

  const events = await prisma.event.findMany({
    where: {
      status: 'ACTIVE',
      eventDate: { gte: now, lte: cutoff },
      documents: { none: { documentType: 'COI' } },
    },
    select: {
      id: true, eventName: true, eventDate: true, companyId: true,
      owner: { select: { name: true, email: true } },
    },
  })

  let emailsSent = 0
  for (const event of events) {
    if (!event.owner.email || !event.eventDate) continue
    emailMissingCoi(event.owner.email, event.owner.name ?? 'there', {
      eventName: event.eventName,
      eventDate: event.eventDate.toISOString().slice(0, 10),
      eventId: event.id,
    }, event.companyId).catch(() => {})
    emailsSent++
  }

  return NextResponse.json({ success: true, eventsChecked: events.length, emailsSent })
}
