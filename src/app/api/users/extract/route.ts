import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'

export type ExtractedUser = {
  name: string
  email: string
  role: string
  password: string
  errors: string[]
}

const VALID_ROLES = ['EMPLOYEE', 'MANAGER', 'TRAVEL_AGENT', 'FINANCE_ADMIN', 'SYSTEM_ADMIN']

function randomPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `Temp_${s}!`
}

function normaliseRole(raw: string): string {
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '_')
  if (VALID_ROLES.includes(upper)) return upper
  // fuzzy aliases
  if (upper === 'ADMIN' || upper === 'SYSTEM') return 'SYSTEM_ADMIN'
  if (upper === 'FINANCE') return 'FINANCE_ADMIN'
  if (upper === 'AGENT' || upper === 'TRAVEL') return 'TRAVEL_AGENT'
  return upper
}

function validate(raw: { name?: string; email?: string; role?: string; password?: string }): ExtractedUser {
  const errors: string[] = []
  if (!raw.name?.trim()) errors.push('Name is required')
  if (!raw.email?.trim()) errors.push('Email is required')
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email.trim())) errors.push('Email is invalid')

  const role = normaliseRole(raw.role ?? '')
  if (!VALID_ROLES.includes(role)) errors.push(`Role "${raw.role}" is not valid — use EMPLOYEE, MANAGER, TRAVEL_AGENT, FINANCE_ADMIN, or SYSTEM_ADMIN`)

  const password = raw.password?.trim() || randomPassword()

  return {
    name: raw.name?.trim() ?? '',
    email: raw.email?.trim().toLowerCase() ?? '',
    role: VALID_ROLES.includes(role) ? role : 'EMPLOYEE',
    password,
    errors,
  }
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

const AI_PROMPT = `Extract all users from this document and return a JSON array. Each object must have these exact keys (use empty string "" for missing optional values):
- name: string    (full name — required)
- email: string   (email address — required)
- role: string    (one of: EMPLOYEE, MANAGER, TRAVEL_AGENT, FINANCE_ADMIN, SYSTEM_ADMIN — default "EMPLOYEE")
- password: string (password if provided, otherwise "")

Return ONLY the raw JSON array — no markdown, no explanation. Example:
[{"name":"Anna Svensson","email":"anna@example.com","role":"EMPLOYEE","password":""},{"name":"Erik Holm","email":"erik@example.com","role":"MANAGER","password":""}]`

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

  let users: ExtractedUser[] = []

  if (isXLSX) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    if (rows.length < 2)
      return NextResponse.json({ error: 'Excel file is empty or has no data rows' }, { status: 400 })

    const headers = (rows[0] as string[]).map((h) => String(h ?? '').trim())
    users = (rows.slice(1) as string[][])
      .filter((row) => row.some((cell) => cell !== undefined && cell !== ''))
      .map((row) => {
        const get = (col: string) => String(row[headers.indexOf(col)] ?? '').trim()
        return validate({
          name: get('Name') || get('name') || get('Full Name') || get('fullName'),
          email: get('Email') || get('email') || get('Email Address'),
          role: get('Role') || get('role'),
          password: get('Password') || get('password'),
        })
      })
  } else if (isCSV) {
    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0)
      return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 })

    users = rows.map((row) =>
      validate({
        name: row['Name'] ?? row['name'] ?? row['Full Name'] ?? row['fullName'],
        email: row['Email'] ?? row['email'] ?? row['Email Address'],
        role: row['Role'] ?? row['role'],
        password: row['Password'] ?? row['password'],
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

    let rawUsers: { name?: string; email?: string; role?: string; password?: string }[] = []
    try {
      const match = responseText.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('No JSON array found')
      rawUsers = JSON.parse(match[0])
    } catch {
      return NextResponse.json(
        { error: 'Could not parse user data from the PDF. Please verify the document contains user information.' },
        { status: 422 }
      )
    }

    if (!Array.isArray(rawUsers) || rawUsers.length === 0)
      return NextResponse.json({ error: 'No users found in the PDF.' }, { status: 422 })

    users = rawUsers.map((u) => validate(u))
  }

  return NextResponse.json({ users })
}
