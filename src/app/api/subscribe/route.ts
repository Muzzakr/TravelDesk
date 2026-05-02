import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email'

const subscribers = new Map<string, { email: string; subscribedAt: Date; confirmed: boolean }>()

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ message: 'Invalid email' }, { status: 400 })
  }

  if (subscribers.has(email)) {
    return NextResponse.json({ message: 'Already subscribed' }, { status: 409 })
  }

  subscribers.set(email, { email, subscribedAt: new Date(), confirmed: false })

  try {
    await sendWelcomeEmail(email)
  } catch (err) {
    console.error('Welcome email failed:', err)
  }

  return NextResponse.json({ message: 'Subscribed successfully' }, { status: 201 })
}
