import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type AllowedMime = typeof ALLOWED_TYPES[number]
const MAX_BYTES = 5 * 1024 * 1024

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validDate(val: unknown): string | null {
  if (typeof val !== 'string') return null
  return DATE_RE.test(val.trim()) ? val.trim() : null
}

function validStr(val: unknown): string | null {
  if (typeof val !== 'string') return null
  const t = val.trim()
  return t.length > 0 ? t : null
}

const PASSPORT_PROMPT = `You are reading a passport document image. Extract the following fields and return ONLY a valid JSON object with no markdown, no explanation:
{
  "documentNumber": "<passport number as printed, or null>",
  "dateOfBirth": "<YYYY-MM-DD or null>",
  "issueDate": "<YYYY-MM-DD or null>",
  "expiryDate": "<YYYY-MM-DD or null>"
}
Convert all dates to YYYY-MM-DD format. If a field is not visible or unreadable, use null.`

const DL_PROMPT = `You are reading a driver's license document image. Extract the following fields and return ONLY a valid JSON object with no markdown, no explanation:
{
  "documentNumber": "<license/document number as printed, or null>",
  "dateOfBirth": "<YYYY-MM-DD or null>",
  "issueDate": "<YYYY-MM-DD or null>",
  "expiryDate": "<YYYY-MM-DD or null>"
}
Convert all dates to YYYY-MM-DD format. If a field is not visible or unreadable, use null.`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file')
  const documentType = form.get('documentType')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (documentType !== 'passport' && documentType !== 'drivers_license') {
    return NextResponse.json({ error: 'Invalid documentType' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type as AllowedMime)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF images are supported' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mimeType = file.type as AllowedMime

  const prompt = documentType === 'passport' ? PASSPORT_PROMPT : DL_PROMPT

  let rawText: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    })
    const block = response.content[0]
    rawText = block.type === 'text' ? block.text : ''
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ocr-scan] Anthropic error:', msg)
    return NextResponse.json({ error: 'OCR service unavailable', detail: msg }, { status: 502 })
  }

  let parsed: Record<string, unknown>
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  } catch {
    parsed = {}
  }

  if (documentType === 'passport') {
    return NextResponse.json({
      documentNumber: validStr(parsed.documentNumber),
      dateOfBirth:    validDate(parsed.dateOfBirth),
      issueDate:      validDate(parsed.issueDate),
      expiryDate:     validDate(parsed.expiryDate),
    })
  } else {
    return NextResponse.json({
      documentNumber: validStr(parsed.documentNumber),
      dateOfBirth:    validDate(parsed.dateOfBirth),
      issueDate:      validDate(parsed.issueDate),
      expiryDate:     validDate(parsed.expiryDate),
    })
  }
}
