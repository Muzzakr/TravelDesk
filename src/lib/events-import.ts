// Pure CSV parsing + row validation for bulk event import, shared by the
// preview and commit API routes (src/app/api/events/import/...) so a
// previewed row is guaranteed to parse identically at commit time.

export interface ParsedEventRow {
  rowNum: number
  eventCode: string
  eventName: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  venue?: string
  address?: string
  eventDate?: string // ISO yyyy-mm-dd
  timing?: string
  assignedDj?: string
  assignedMc?: string
  salesPerson?: string
}

export function parseEventsCsv(text: string): { rows: string[][]; headers: string[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return { rows: [], headers: [] }

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
  const rows = lines.slice(1).map(parseLine)
  return { rows, headers }
}

export function normaliseDate(raw: string): string {
  if (!raw) return ''
  const first = raw.split(',')[0].trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) return first
  const m = first.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[1]}-${m[2]}`
  const d = new Date(first)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/**
 * Parses + validates every row of an events CSV. Returns valid rows
 * (ready to preview/create) separately from row-level error messages —
 * one bad row never blocks the rest of a file.
 */
export function parseAndValidateEventsCsv(text: string): { rows: ParsedEventRow[]; errors: string[] } {
  const { rows: rawRows, headers } = parseEventsCsv(text)
  const errors: string[] = []
  const rows: ParsedEventRow[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const values = rawRows[i]
    const row = Object.fromEntries(headers.map((h, idx) => [h, values[idx] ?? '']))
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
    const rawDate = row['Date'] ?? row['eventDate'] ?? ''
    if (rawDate && !eventDate) { errors.push(`Row ${lineNum}: Date must be a valid date`); continue }

    rows.push({
      rowNum: lineNum,
      eventCode,
      eventName,
      status,
      ...(venue ? { venue } : {}),
      ...(address ? { address } : {}),
      ...(eventDate ? { eventDate } : {}),
      ...(timing ? { timing } : {}),
      ...(assignedDj ? { assignedDj } : {}),
      ...(assignedMc ? { assignedMc } : {}),
      ...(salesPerson ? { salesPerson } : {}),
    })
  }

  return { rows, errors }
}
