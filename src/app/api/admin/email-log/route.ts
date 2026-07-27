import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma, EmailStatus } from '@prisma/client'

const STATUSES = ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] as const

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const search = searchParams.get('search')?.trim()
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Prisma.EmailLogWhereInput = { companyId: session.user.companyId }
  if (status && (STATUSES as readonly string[]).includes(status)) where.status = status as EmailStatus
  if (type) where.type = type
  if (from || to) {
    where.createdAt = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000) }),
    }
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { to: { has: search } },
    ]
  }

  const logs = await prisma.emailLog.findMany({
    where,
    select: {
      id: true, type: true, to: true, subject: true, status: true, attempts: true,
      errorMessage: true, relatedEntityType: true, relatedEntityId: true, createdAt: true, sentAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  return NextResponse.json(logs)
}
