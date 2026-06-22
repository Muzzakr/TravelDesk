import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const transactions = await prisma.cardTransaction.findMany({
    where: {
      companyId: session.user.companyId,
      ...(status ? { status: status as 'PENDING_TAG' | 'TAGGED' | 'SUBMITTED' | 'MATCHED' } : {}),
    },
    orderBy: { transactionDate: 'desc' },
    take: 100,
  })

  const employeeIds = [...new Set(transactions.map((t) => t.employeeId).filter(Boolean))] as string[]
  const employees = await prisma.user.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, name: true },
  })
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e.name]))

  return NextResponse.json(
    transactions.map((t) => ({ ...t, employeeName: t.employeeId ? (empMap[t.employeeId] ?? 'Unknown') : null }))
  )
}

const ManualSchema = z.object({
  merchant:        z.string().min(1),
  amountUsd:       z.number().positive(),
  currency:        z.string().default('USD'),
  transactionDate: z.string().min(1),
  cardProgram:     z.string().min(1),
  employeeId:      z.string().optional(),
  eventId:         z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = ManualSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const tx = await prisma.cardTransaction.create({
    data: {
      companyId:       session.user.companyId,
      transactionId:   `manual-${randomUUID()}`,
      merchant:        parsed.data.merchant,
      amountUsd:       parsed.data.amountUsd,
      currency:        parsed.data.currency,
      transactionDate: new Date(parsed.data.transactionDate),
      cardProgram:     parsed.data.cardProgram,
      employeeId:      parsed.data.employeeId ?? null,
      eventId:         parsed.data.eventId ?? null,
      status:          parsed.data.eventId ? 'TAGGED' : 'PENDING_TAG',
    },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId:   session.user.id,
    action:    'CARD_TRANSACTION_MANUAL',
    entityType: 'CardTransaction',
    entityId:  tx.id,
    payload:   { merchant: tx.merchant, amountUsd: Number(tx.amountUsd) },
  })

  return NextResponse.json(tx, { status: 201 })
}

const TagSchema = z.object({ eventId: z.string(), employeeId: z.string().optional() })

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const body = await req.json()
  const parsed = TagSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.cardTransaction.update({
    where: { id },
    data: { eventId: parsed.data.eventId, status: 'TAGGED', ...(parsed.data.employeeId ? { employeeId: parsed.data.employeeId } : {}) },
  })

  return NextResponse.json(updated)
}
