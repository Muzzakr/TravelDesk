import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['TRAVEL_AGENT', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  const message = await prisma.travelInboxMessage.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'Slack bot token not configured' }, { status: 503 })
  if (!message.slackChannelId) return NextResponse.json({ error: 'No Slack channel on this message' }, { status: 422 })

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      channel: message.slackChannelId,
      thread_ts: message.slackThreadTs ?? message.slackMsgTs,
      text: `[M4U Travel – ${session.user.name}]: ${text}`,
    }),
  })

  const data = await res.json()
  if (!data.ok) return NextResponse.json({ error: data.error ?? 'Slack error' }, { status: 502 })

  return NextResponse.json({ ok: true })
}
