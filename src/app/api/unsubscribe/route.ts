import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, clientIp } from '@/lib/rate-limit'

async function unsubscribe(email: string): Promise<boolean> {
  const existing = await prisma.subscriber.findUnique({ where: { email } })
  if (!existing) return false
  if (!existing.unsubscribedAt) {
    await prisma.subscriber.update({
      where: { email },
      data: { unsubscribedAt: new Date() },
    })
  }
  return true
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(`unsubscribe:${clientIp(req)}`, 10, 15 * 60_000))) {
    return NextResponse.json({ message: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const { email } = await req.json().catch(() => ({ email: '' }))
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ message: 'Invalid email' }, { status: 400 })
  }

  await unsubscribe(email.trim().toLowerCase())
  // Always report success — don't reveal whether the address was subscribed
  return NextResponse.json({ message: 'Unsubscribed successfully' })
}

// The unsubscribe link in the welcome email is a plain GET
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`unsubscribe:${clientIp(req)}`, 10, 15 * 60_000))) {
    return new NextResponse('Too many requests. Try again later.', { status: 429 })
  }

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? ''
  if (email) await unsubscribe(email)

  return new NextResponse(
    `<!doctype html><html><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center">
      <h1 style="font-size:20px;color:#111827">You have been unsubscribed</h1>
      <p style="color:#6b7280;font-size:14px">You will no longer receive newsletter emails from M4U Travel.</p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
