import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
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
  eventUrl: string
  packageName: string
  packageDetails: string
  addonNames: string
  publicNotes: string
  privateNotes: string
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

function normaliseStatus(raw: string): 'DRAFT' | 'ACTIVE' | 'CLOSED' {
  const u = (raw ?? '').toUpperCase().trim()
  if (u === 'CONFIRMED' || u === 'ACTIVE') return 'ACTIVE'
  if (u === 'DRAFT') return 'DRAFT'
  // Expired Proposal, Canceled Booking, Canceled Proposal → CLOSED
  if (u.includes('CANCEL') || u.includes('EXPIRED')) return 'CLOSED'
  if (['DRAFT', 'ACTIVE', 'CLOSED'].includes(u)) return u as 'DRAFT' | 'ACTIVE' | 'CLOSED'
  return 'DRAFT'
}

// Extract DJ and MC names from combined "Assigned Staff" field
function splitStaff(staff: string): { dj: string; mc: string } {
  if (!staff) return { dj: '', mc: '' }
  const parts = staff.split(',').map((s) => s.trim())
  const djs = parts.filter((p) => p.toLowerCase().includes('dj') || p.toLowerCase().includes('rokit') || p.toLowerCase().includes('vinyl') || p.toLowerCase().includes('vynl'))
  const mcs = parts.filter((p) => p.toLowerCase().includes('mc') || p.toLowerCase().includes('mc '))
  return {
    dj: djs.join(', '),
    mc: mcs.join(', '),
  }
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
    eventUrl: raw.eventUrl?.trim() ?? '',
    packageName: raw.packageName?.trim() ?? '',
    packageDetails: raw.packageDetails?.trim() ?? '',
    addonNames: raw.addonNames?.trim() ?? '',
    publicNotes: raw.publicNotes?.trim() ?? '',
    privateNotes: raw.privateNotes?.trim() ?? '',
    errors,
  }
}

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

  if (!isCSV && !isXLSX)
    return NextResponse.json({ error: 'Only CSV and Excel (.xlsx) files are supported' }, { status: 400 })

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
          eventUrl: get('Event URL') || get('eventUrl'),
          packageName: get('Package Name') || get('packageName'),
          packageDetails: get('Package Details') || get('packageDetails'),
          addonNames: get('Add-on Names') || get('addonNames'),
          publicNotes: get('Public Notes') || get('publicNotes'),
          privateNotes: get('Private Notes') || get('privateNotes'),
        })
      })
  } else {
    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0)
      return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 })

    events = rows.map((row) => {
      // Support both standard column names AND the report.csv format (ID, Name, Event Date, Venue Name, etc.)
      const staff = splitStaff(row['Assigned Staff'] ?? row['assigned_staff'] ?? '')
      return validate({
        eventCode: row['Event Code'] ?? row['eventCode'] ?? row['ID'] ?? row['id'] ?? '',
        eventName: row['Event Name'] ?? row['eventName'] ?? row['Name'] ?? row['name'] ?? '',
        venue: row['Venue'] ?? row['venue'] ?? row['Venue Name'] ?? row['venue_name'] ?? '',
        address: row['Address'] ?? row['address'] ?? row['Venue Full Address'] ?? row['venue_full_address'] ?? '',
        eventDate: normaliseDate(row['Date'] ?? row['eventDate'] ?? row['Event Date'] ?? row['event_date'] ?? ''),
        timing: row['Timing'] ?? row['timing'] ?? row['Start Time'] ?? row['start_time'] ?? '',
        assignedDj: row['Assigned DJ'] ?? row['Assigned_DJ'] ?? row['assignedDj'] ?? staff.dj,
        assignedMc: row['Assigned MC'] ?? row['Assigned_MC'] ?? row['assignedMc'] ?? staff.mc,
        salesPerson: row['Sales Person'] ?? row['Sales_Person'] ?? row['salesPerson'] ?? row['Created by'] ?? row['created_by'] ?? '',
        status: normaliseStatus(row['Status'] ?? row['status'] ?? 'DRAFT'),
        eventUrl: row['Event URL'] ?? row['eventUrl'] ?? '',
        packageName: row['Package Name'] ?? row['packageName'] ?? '',
        packageDetails: row['Package Details'] ?? row['packageDetails'] ?? '',
        addonNames: row['Add-on Names'] ?? row['addonNames'] ?? '',
        publicNotes: row['Public Notes'] ?? row['publicNotes'] ?? '',
        privateNotes: row['Private Notes'] ?? row['privateNotes'] ?? '',
      })
    })
  }

  const fileType = isCSV ? 'csv' : 'xlsx'
  return NextResponse.json({ events, fileType })
}
