import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import crypto from 'crypto'

const CardTransactionSchema = z.object({
  transactionId: z.string(),
  companySlug: z.string(),
  employeeEmail: z.string().email().optional(),
  merchant: z.string(),
  amountUsd: z.number().positive(),
  currency: z.string().default('USD'),
  transactionDate: z.string(),
  mccCode: z.string().optional(),
  cardProgram: z.string(),
})

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.CARD_FEED_WEBHOOK_SECRET
  if (!secret) return false
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-webhook-signature') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CardTransactionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const company = await prisma.company.findUnique({ where: { slug: parsed.data.companySlug } })
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  let employeeId: string | undefined
  if (parsed.data.employeeEmail) {
    const user = await prisma.user.findUnique({
      where: { companyId_email: { companyId: company.id, email: parsed.data.employeeEmail } },
    })
    employeeId = user?.id
  }

  const tx = await prisma.cardTransaction.upsert({
    where: { transactionId: parsed.data.transactionId },
    update: {},
    create: {
      companyId: company.id,
      employeeId: employeeId ?? null,
      transactionId: parsed.data.transactionId,
      merchant: parsed.data.merchant,
      amountUsd: parsed.data.amountUsd,
      currency: parsed.data.currency,
      transactionDate: new Date(parsed.data.transactionDate),
      mccCode: parsed.data.mccCode,
      cardProgram: parsed.data.cardProgram,
      status: 'PENDING_TAG',
    },
  })

  await writeAuditLog({
    companyId: company.id,
    action: 'CARD_TRANSACTION_RECEIVED',
    entityType: 'CardTransaction',
    entityId: tx.id,
    payload: { transactionId: parsed.data.transactionId, merchant: parsed.data.merchant, amountUsd: parsed.data.amountUsd },
  })

  return NextResponse.json({ received: true, id: tx.id })
}
