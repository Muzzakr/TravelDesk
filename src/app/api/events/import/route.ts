import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  function parseLine(line: string): string[] {
    const result: string[] = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur.trim())
    return result
  }
  const headers = parseLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = parseLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function normaliseDate(raw: string): string {
  if (!raw) return ''
  const first = raw.split(',')[0].trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) return first
  const m = first.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[1]}-${m[2]}`
  const d = new Date(first)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) return NextResponse.json({ error: 'CSV is empty or invalid' }, { status: 400 })

  const companyId = session.user.companyId
  const errors: string[] = []
  const toCreate: Parameters<typeof prisma.event.create>[0]['data'][] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const lineNum = i + 2
    const eventCode = row['Event Code'] ?? row['eventCode'] ?? ''
    const eventName = row['Event Name'] ?? row['eventName'] ?? ''
    const venue = row['Venue'] ?? row['venue'] ?? ''
    const address = row['Address'] ?? row['address'] ?? ''
    const eventDate = normaliseDate(row['Date'] ?? row['eventDate'] ?? '')
    const timing = row['Timing'] ?? row['timing'] ?? ''
    const assignedDj = row['Assigned DJ'] ?? row['Assigned_DJ'] ?? row['assignedDj'] ?? ''
    const assignedMc = row['Assigned MC'] ?? row['Assigned_MC'] ?? row['assignedMc'] ?? ''
    const salesPerson = row['Sales Person'] ?? row['Sales_Person'] ?? row['salesPerson'] ?? ''
    const status = (row['Status'] ?? row['status'] ?? 'DRAFT').toUpperCase() as 'DRAFT' | 'ACTIVE' | 'CLOSED'

    if (!eventCode) { errors.push(`Row ${lineNum}: Event Code is required`); continue }
    if (!eventName) { errors.push(`Row ${lineNum}: Event Name is required`); continue }
    if (!['DRAFT', 'ACTIVE', 'CLOSED'].includes(status)) { errors.push(`Row ${lineNum}: Status must be DRAFT, ACTIVE, or CLOSED`); continue }
    if (eventDate && isNaN(Date.parse(eventDate))) { errors.push(`Row ${lineNum}: Date must be a valid date`); continue }

    toCreate.push({
      companyId,
      ownerUserId: session.user.id,
      eventCode,
      eventName,
      status,
      ...(venue ? { venue } : {}),
      ...(address ? { address } : {}),
      ...(eventDate ? { eventDate: new Date(eventDate) } : {}),
      ...(timing ? { timing } : {}),
      ...(assignedDj ? { assignedDj } : {}),
      ...(assignedMc ? { assignedMc } : {}),
      ...(salesPerson ? { salesPerson } : {}),
    })
  }

  if (errors.length > 0 && toCreate.length === 0)
    return NextResponse.json({ error: 'All rows failed validation', details: errors }, { status: 400 })

  let created = 0
  for (const data of toCreate) {
    try {
      await prisma.event.create({ data })
      created++
    } catch {
      errors.push(`Failed to create event "${String(data.eventCode)}" — event code may already exist`)
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
