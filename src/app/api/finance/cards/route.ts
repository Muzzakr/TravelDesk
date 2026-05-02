import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const transactions = await prisma.cardTransaction.findMany({
    where: {
      companyId: session.user.companyId,
      ...(status ? { status } : {}),
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

const TagSchema = z.object({ eventId: z.string() })

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const body = await req.json()
  const parsed = TagSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.cardTransaction.update({
    where: { id },
    data: { eventId: parsed.data.eventId, status: 'TAGGED' },
  })

  return NextResponse.json(updated)
}
