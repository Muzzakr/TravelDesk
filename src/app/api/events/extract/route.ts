import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'

export type ExtractedEvent = {
  eventCode: string
  eventName: string
  venue: string
  address: string
  eventDate: string
  timing: string
  assignedDj: string
  assignedMc: string
  salesPerson: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  errors: string[]
}

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

function validate(raw: Partial<ExtractedEvent>): ExtractedEvent {
  const errors: string[] = []
  if (!raw.eventCode?.trim()) errors.push('Event Code is required')
  if (!raw.eventName?.trim()) errors.push('Event Name is required')
  if (raw.eventDate && raw.eventDate.trim() && isNaN(Date.parse(raw.eventDate)))
    errors.push('Date must be YYYY-MM-DD')

  const rawStatus = (raw.status ?? '').toString().toUpperCase()
  const status: 'DRAFT' | 'ACTIVE' | 'CLOSED' = ['DRAFT', 'ACTIVE', 'CLOSED'].includes(rawStatus)
    ? (rawStatus as 'DRAFT' | 'ACTIVE' | 'CLOSED')
    : 'DRAFT'

  return {
    eventCode: raw.eventCode?.trim() ?? '',
    eventName: raw.eventName?.trim() ?? '',
    venue: raw.venue?.trim() ?? '',
    address: raw.address?.trim() ?? '',
    eventDate: raw.eventDate?.trim() ?? '',
    timing: raw.timing?.trim() ?? '',
    assignedDj: raw.assignedDj?.trim() ?? '',
    assignedMc: raw.assignedMc?.trim() ?? '',
    salesPerson: raw.salesPerson?.trim() ?? '',
    status,
    errors,
  }
}

const AI_PROMPT = `Extract all events from this document and return a JSON array. Each object must have these exact keys (use empty string "" for missing optional values):
- eventCode: string  (event ID/code, e.g. "EVT-001"; generate a placeholder like "EVT-???" if not found)
- eventName: string  (name of the event — required)
- venue: string      (venue/location name)
- address: string    (full street address)
- eventDate: string  (date in YYYY-MM-DD format, or "" if unknown)
- timing: string     (time range, e.g. "18:00-23:00", or "" if unknown)
- assignedDj: string (DJ name, or "")
- assignedMc: string (MC/host name, or "")
- salesPerson: string (sales person name, or "")
- status: "DRAFT" | "ACTIVE" | "CLOSED"  (default "DRAFT")

Return ONLY the raw JSON array — no markdown, no explanation. Example:
[{"eventCode":"EVT-001","eventName":"Summer Gala","venue":"Grand Ballroom","address":"123 Main St, New York, NY 10001","eventDate":"2026-08-15","timing":"6:00 PM - 11:00 PM","assignedDj":"DJ Alex","assignedMc":"MC Sara","salesPerson":"John Smith","status":"DRAFT"}]`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const name = file.name.toLowerCase()
  const isCSV = name.endsWith('.csv') || file.type === 'text/csv'
  const isXLSX = name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const isPDF = name.endsWith('.pdf') || file.type === 'application/pdf'

  if (!isCSV && !isXLSX && !isPDF)
    return NextResponse.json({ error: 'Only CSV, Excel (.xlsx), and PDF files are supported' }, { status: 400 })

  let events: ExtractedEvent[] = []

  if (isXLSX) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    if (rows.length < 2)
      return NextResponse.json({ error: 'Excel file is empty or has no data rows' }, { status: 400 })

    const headers = (rows[0] as string[]).map((h) => String(h ?? '').trim())
    events = (rows.slice(1) as string[][])
      .filter((row) => row.some((cell) => cell !== undefined && cell !== ''))
      .map((row) => {
        const get = (col: string) => String(row[headers.indexOf(col)] ?? '').trim()
        return validate({
          eventCode: get('Event Code') || get('eventCode'),
          eventName: get('Event Name') || get('eventName'),
          venue: get('Venue') || get('venue'),
          address: get('Address') || get('address'),
          eventDate: get('Date') || get('eventDate'),
          timing: get('Timing') || get('timing'),
          assignedDj: get('Assigned DJ') || get('assignedDj'),
          assignedMc: get('Assigned MC') || get('assignedMc'),
          salesPerson: get('Sales Person') || get('salesPerson'),
          status: (get('Status') || get('status') || 'DRAFT') as 'DRAFT',
        })
      })
  } else if (isCSV) {
    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0)
      return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 })

    events = rows.map((row) =>
      validate({
        eventCode: row['Event Code'] ?? row['eventCode'],
        eventName: row['Event Name'] ?? row['eventName'],
        venue: row['Venue'] ?? row['venue'],
        address: row['Address'] ?? row['address'],
        eventDate: normaliseDate(row['Date'] ?? row['eventDate'] ?? ''),
        timing: row['Timing'] ?? row['timing'],
        assignedDj: row['Assigned DJ'] ?? row['Assigned_DJ'] ?? row['assignedDj'],
        assignedMc: row['Assigned MC'] ?? row['Assigned_MC'] ?? row['assignedMc'],
        salesPerson: row['Sales Person'] ?? row['Sales_Person'] ?? row['salesPerson'],
        status: (row['Status'] ?? row['status'] ?? 'DRAFT') as 'DRAFT',
      })
    )
  } else {
    // PDF — send to Claude
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey)
      return NextResponse.json({ error: 'AI extraction not configured (missing ANTHROPIC_API_KEY)' }, { status: 500 })

    const client = new Anthropic({ apiKey })
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    let responseText = ''
    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              },
              { type: 'text', text: AI_PROMPT },
            ],
          },
        ],
      })
      responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    } catch (err) {
      console.error('Claude API error:', err)
      return NextResponse.json({ error: 'AI extraction failed. Please try a CSV file instead.' }, { status: 502 })
    }

    // Extract JSON array from response
    let rawEvents: Partial<ExtractedEvent>[] = []
    try {
      const match = responseText.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('No JSON array found')
      rawEvents = JSON.parse(match[0])
    } catch {
      return NextResponse.json(
        { error: 'Could not parse event data from the PDF. Please verify the document contains event information.' },
        { status: 422 }
      )
    }

    if (!Array.isArray(rawEvents) || rawEvents.length === 0)
      return NextResponse.json({ error: 'No events found in the PDF.' }, { status: 422 })

    events = rawEvents.map((e) => validate(e))
  }

  const fileType = isCSV ? 'csv' : isXLSX ? 'xlsx' : 'pdf'
  return NextResponse.json({ events, fileType })
}
