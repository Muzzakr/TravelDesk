/**
 * @jest-environment node
 */
import { parseAndValidateEventsCsv, normaliseDate } from '@/lib/events-import'

describe('normaliseDate', () => {
  it('passes through ISO yyyy-mm-dd unchanged', () => {
    expect(normaliseDate('2026-11-15')).toBe('2026-11-15')
  })

  it('converts mm-dd-yyyy to ISO', () => {
    expect(normaliseDate('11-15-2026')).toBe('2026-11-15')
  })

  it('returns empty string for unparseable input', () => {
    expect(normaliseDate('not a date')).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(normaliseDate('')).toBe('')
  })
})

describe('parseAndValidateEventsCsv', () => {
  it('parses a valid row with all optional columns', () => {
    const csv = [
      'Event Code,Event Name,Status,Venue,Date,Timing,Assigned DJ,Assigned MC,Sales Person',
      'EVT-101,Q1 Kickoff,ACTIVE,Grand Hall,2026-11-15,6-11 PM,DJ Mike,Sarah K,John D',
    ].join('\n')
    const { rows, errors } = parseAndValidateEventsCsv(csv)
    expect(errors).toEqual([])
    expect(rows).toEqual([{
      rowNum: 2,
      eventCode: 'EVT-101',
      eventName: 'Q1 Kickoff',
      status: 'ACTIVE',
      venue: 'Grand Hall',
      eventDate: '2026-11-15',
      timing: '6-11 PM',
      assignedDj: 'DJ Mike',
      assignedMc: 'Sarah K',
      salesPerson: 'John D',
    }])
  })

  it('defaults status to DRAFT when omitted', () => {
    const csv = ['Event Code,Event Name', 'EVT-102,Spring Gala'].join('\n')
    const { rows, errors } = parseAndValidateEventsCsv(csv)
    expect(errors).toEqual([])
    expect(rows[0].status).toBe('DRAFT')
  })

  it('accepts camelCase header variants', () => {
    const csv = ['eventCode,eventName,assignedDj', 'EVT-103,Fall Mixer,DJ Sam'].join('\n')
    const { rows } = parseAndValidateEventsCsv(csv)
    expect(rows[0]).toMatchObject({ eventCode: 'EVT-103', eventName: 'Fall Mixer', assignedDj: 'DJ Sam' })
  })

  it('rejects a row missing Event Code, keeps processing the rest', () => {
    const csv = [
      'Event Code,Event Name',
      ',Missing Code',
      'EVT-104,Has Code',
    ].join('\n')
    const { rows, errors } = parseAndValidateEventsCsv(csv)
    expect(errors).toEqual(['Row 2: Event Code is required'])
    expect(rows).toHaveLength(1)
    expect(rows[0].eventCode).toBe('EVT-104')
  })

  it('rejects a row missing Event Name', () => {
    const csv = ['Event Code,Event Name', 'EVT-105,'].join('\n')
    const { errors } = parseAndValidateEventsCsv(csv)
    expect(errors).toEqual(['Row 2: Event Name is required'])
  })

  it('rejects an invalid Status', () => {
    const csv = ['Event Code,Event Name,Status', 'EVT-106,Test,WRONG'].join('\n')
    const { errors } = parseAndValidateEventsCsv(csv)
    expect(errors).toEqual(['Row 2: Status must be DRAFT, ACTIVE, or CLOSED'])
  })

  it('rejects an unparseable Date', () => {
    const csv = ['Event Code,Event Name,Date', 'EVT-107,Test,not-a-real-date-at-all'].join('\n')
    const { errors } = parseAndValidateEventsCsv(csv)
    expect(errors).toEqual(['Row 2: Date must be a valid date'])
  })

  it('handles quoted commas inside a field', () => {
    const csv = [
      'Event Code,Event Name,Venue',
      '"EVT-108","Launch, Part 2","Hall, Building B"',
    ].join('\n')
    const { rows } = parseAndValidateEventsCsv(csv)
    expect(rows[0]).toMatchObject({ eventCode: 'EVT-108', eventName: 'Launch, Part 2', venue: 'Hall, Building B' })
  })

  it('returns no rows and no errors for an empty/header-only file', () => {
    const { rows, errors } = parseAndValidateEventsCsv('Event Code,Event Name')
    expect(rows).toEqual([])
    expect(errors).toEqual([])
  })
})
