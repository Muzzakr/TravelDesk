import { NextRequest, NextResponse } from 'next/server'
import { sendDemoRequest } from '@/lib/mail'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  // Public endpoint that sends email — throttle per IP
  if (!(await rateLimit(`contact:${clientIp(req)}`, 5, 15 * 60_000))) {
    return NextResponse.json({ message: 'Too many requests. Try again later.' }, { status: 429 })
  }

  let body: { name?: string; workEmail?: string; company?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 })
  }

  const name = body.name?.trim() ?? ''
  const workEmail = body.workEmail?.trim() ?? ''
  const company = body.company?.trim() ?? ''
  const message = body.message?.trim() ?? ''

  if (!name || !company || !EMAIL_RE.test(workEmail)) {
    return NextResponse.json({ message: 'Please provide your name, company, and a valid work email.' }, { status: 400 })
  }

  try {
    await sendDemoRequest({ name, workEmail, company, message: message || null })
  } catch (err) {
    // Don't fail the visitor's submission if email delivery hiccups — just log it.
    console.error('Demo request email failed:', err)
  }

  return NextResponse.json({ message: 'Thanks — we will be in touch shortly.' }, { status: 201 })
}
