import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function bucket(date: Date, granularity: string): string {
  if (granularity === 'daily') {
    return date.toISOString().slice(0, 10)
  }
  if (granularity === 'weekly') {
    return isoWeek(date)
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const granularity = searchParams.get('granularity') ?? 'monthly'
  const eventId     = searchParams.get('eventId') ?? ''
  const category    = searchParams.get('category') ?? ''

  const expenses = await prisma.expense.findMany({
    where: {
      companyId: session.user.companyId,
      status: 'APPROVED',
      ...(eventId   ? { eventId }   : {}),
      ...(category  ? { category: category as 'MEALS' | 'TRANSPORT' | 'ACCOMMODATION' | 'SUPPLIES' | 'OTHER' } : {}),
    },
    select: { amountUsd: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const map = new Map<string, number>()
  for (const e of expenses) {
    const key = bucket(e.createdAt, granularity)
    map.set(key, (map.get(key) ?? 0) + Number(e.amountUsd))
  }

  const data = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, totalUsd]) => ({ period, totalUsd: Math.round(totalUsd * 100) / 100 }))

  let budgetUsd: number | null = null
  if (eventId) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, companyId: session.user.companyId },
      select: { budgetUsd: true },
    })
    if (event && Number(event.budgetUsd) > 0) budgetUsd = Number(event.budgetUsd)
  }

  return NextResponse.json({ data, budgetUsd })
}
