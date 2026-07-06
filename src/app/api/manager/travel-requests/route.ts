import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId
  const { searchParams } = new URL(req.url)
  const status     = searchParams.get('status') ?? ''
  const employeeId = searchParams.get('employeeId') ?? ''
  const managerId  = searchParams.get('managerId') ?? ''
  const search     = searchParams.get('search') ?? ''
  const page       = parseInt(searchParams.get('page') ?? '1')
  const pageSize   = 15

  const where: Record<string, unknown> = { companyId }
  if (status)     where.status = status
  if (employeeId) where.employeeId = employeeId
  if (managerId)  where.managerId = managerId
  if (search) {
    where.OR = [
      { employee: { name:  { contains: search, mode: 'insensitive' } } },
      { origin:            { contains: search, mode: 'insensitive' } },
      { destination:       { contains: search, mode: 'insensitive' } },
      { event: { eventName: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [requests, total, counts] = await Promise.all([
    prisma.travelRequest.findMany({
      where: where as never,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        event:    { select: { eventName: true, eventCode: true } },
        agent:    { select: { id: true, name: true } },
        manager:  { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.travelRequest.count({ where: where as never }),
    prisma.travelRequest.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true },
    }),
  ])

  const countMap: Record<string, number> = {}
  counts.forEach(c => { countMap[c.status] = c._count.id })

  const [employees, managers] = await Promise.all([
    prisma.user.findMany({
      where: { companyId, role: 'EMPLOYEE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { companyId, role: { in: ['MANAGER', 'TRAVEL_MANAGER'] }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({
    requests,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    counts: {
      total:     Object.values(countMap).reduce((s, n) => s + n, 0),
      pending:   (countMap['PENDING_MANAGER'] ?? 0) + (countMap['PENDING_AGENT'] ?? 0)
                 + (countMap['SUBMITTED'] ?? 0) + (countMap['PENDING_ADMIN'] ?? 0),
      approved:  countMap['APPROVED'] ?? 0,
      confirmed: countMap['BOOKING_CONFIRMED'] ?? 0,
    },
    employees,
    managers,
  })
}
