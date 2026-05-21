import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const CHANNEL_MAP: Record<string, 'TRAVEL_CARS' | 'TRAVEL_FLIGHTS' | 'TRAVEL_HOTELS'> = {
  [process.env.SLACK_CHANNEL_CARS    ?? '__unset_cars__']:    'TRAVEL_CARS',
  [process.env.SLACK_CHANNEL_FLIGHTS ?? '__unset_flights__']: 'TRAVEL_FLIGHTS',
  [process.env.SLACK_CHANNEL_HOTELS  ?? '__unset_hotels__']:  'TRAVEL_HOTELS',
}

function verifySlackSignature(signingSecret: string, body: string, timestamp: string, signature: string): boolean {
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (age > 300) return false
  const base = `v0:${timestamp}:${body}`
  const expected = 'v0=' + createHmac('sha256', signingSecret).update(base).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

async function parseWithAI(text: string): Promise<Record<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return {}
  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Extract travel details from this Slack message and return ONLY a JSON object with these keys (use empty string for unknown): {"serviceType":"FLIGHT|HOTEL|CAR_RENTAL|TAXI","employeeName":"","origin":"","destination":"","departureDate":"YYYY-MM-DD or empty","returnDate":"YYYY-MM-DD or empty","notes":""}\nMessage: ${JSON.stringify(text)}`,
      }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : {}
  } catch {
    return {}
  }
}

async function lookupSlackUserName(userId: string): Promise<string> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token || !userId) return userId
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    return data?.user?.real_name || data?.user?.name || userId
  } catch {
    return userId
  }
}

export async function POST(req: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET ?? ''
  const rawBody = await req.text()

  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Slack URL verification challenge (no signature required)
  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge })
  }

  // Verify signature for all other events
  if (signingSecret && !verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = body.event as Record<string, unknown> | undefined
  if (!event || event.type !== 'message') {
    return NextResponse.json({ ok: true })
  }

  // Skip bot messages, message edits, deletions
  if (event.bot_id || event.subtype) {
    return NextResponse.json({ ok: true })
  }

  const channelId = String(event.channel ?? '')
  const channel = CHANNEL_MAP[channelId]
  if (!channel) return NextResponse.json({ ok: true })

  const companyId = process.env.INBOX_COMPANY_ID ?? ''
  if (!companyId) return NextResponse.json({ ok: true })

  const msgTs = String(event.ts ?? '')
  const rawText = String(event.text ?? '').trim()
  if (!rawText) return NextResponse.json({ ok: true })

  // Duplicate guard
  const existing = await prisma.travelInboxMessage.findFirst({
    where: { companyId, slackMsgTs: msgTs },
  })
  if (existing) return NextResponse.json({ ok: true })

  const slackUserId = String(event.user ?? '')

  // Fire-and-forget: AI parse + user lookup + persist
  ;(async () => {
    const [parsedData, slackUserName] = await Promise.all([
      parseWithAI(rawText),
      lookupSlackUserName(slackUserId),
    ])
    await prisma.travelInboxMessage.create({
      data: {
        companyId,
        channel,
        slackUserId,
        slackUserName,
        slackMsgTs: msgTs,
        slackThreadTs: String(event.thread_ts ?? msgTs),
        slackChannelId: channelId,
        rawText,
        parsedData: Object.keys(parsedData).length ? parsedData : undefined,
      },
    })
  })().catch(console.error)

  return NextResponse.json({ ok: true })
}
