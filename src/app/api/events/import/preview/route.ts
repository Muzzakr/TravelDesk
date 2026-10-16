import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseAndValidateEventsCsv } from '@/lib/events-import'

// Parses + validates the uploaded CSV and checks incoming Event Codes
// against what's already in the company, but writes nothing — the admin
// reviews this response and POSTs the approved rows to /api/events/import
// to actually commit them.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const { rows, errors } = parseAndValidateEventsCsv(text)
  if (rows.length === 0 && errors.length === 0)
    return NextResponse.json({ error: 'CSV is empty or invalid' }, { status: 400 })

  const companyId = session.user.companyId
  const existing = rows.length
    ? await prisma.event.findMany({
        where: { companyId, eventCode: { in: rows.map((r) => r.eventCode) } },
        select: { eventCode: true, eventName: true, status: true, eventDate: true, venue: true },
      })
    : []
  const existingByCode = new Map(existing.map((e) => [e.eventCode, e]))

  const toCreate = rows.filter((r) => !existingByCode.has(r.eventCode))
  const duplicates = rows
    .filter((r) => existingByCode.has(r.eventCode))
    .map((r) => ({ incoming: r, existing: existingByCode.get(r.eventCode)! }))

  return NextResponse.json({ toCreate, duplicates, errors })
}
