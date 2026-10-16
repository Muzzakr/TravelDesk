import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import type { ParsedEventRow } from '@/lib/events-import'

// Commits rows already parsed + reviewed via POST /api/events/import/preview
// — the admin approves the preview's `toCreate` list client-side and that
// exact array is sent back here, so this route never re-parses a file.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const events = body?.events as ParsedEventRow[] | undefined
  if (!Array.isArray(events) || events.length === 0)
    return NextResponse.json({ error: 'No events provided' }, { status: 400 })

  const companyId = session.user.companyId
  const errors: string[] = []
  let created = 0

  for (const row of events) {
    if (!row.eventCode || !row.eventName) continue
    try {
      await prisma.event.create({
        data: {
          companyId,
          ownerUserId: session.user.id,
          eventCode: row.eventCode,
          eventName: row.eventName,
          status: row.status ?? 'DRAFT',
          ...(row.venue ? { venue: row.venue } : {}),
          ...(row.address ? { address: row.address } : {}),
          ...(row.eventDate ? { eventDate: new Date(row.eventDate) } : {}),
          ...(row.timing ? { timing: row.timing } : {}),
          ...(row.assignedDj ? { assignedDj: row.assignedDj } : {}),
          ...(row.assignedMc ? { assignedMc: row.assignedMc } : {}),
          ...(row.salesPerson ? { salesPerson: row.salesPerson } : {}),
        },
      })
      created++
    } catch {
      errors.push(`Failed to create event "${row.eventCode}" — event code may already exist`)
    }
  }

  await writeAuditLog({
    companyId,
    actorId: session.user.id,
    action: 'EVENTS_IMPORTED',
    entityType: 'Event',
    entityId: companyId,
    payload: { created, errors: errors.length },
  })

  return NextResponse.json({ created, skipped: errors.length, errors })
}
