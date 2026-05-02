import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ROLE_ORDER = ['SYSTEM_ADMIN', 'FINANCE_ADMIN', 'TRAVEL_AGENT', 'MANAGER', 'EMPLOYEE'] as const

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId

  const [company, users] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, slug: true, plan: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const byRole: Record<string, typeof users> = Object.fromEntries(ROLE_ORDER.map((r) => [r, []]))
  for (const user of users) {
    if (byRole[user.role]) byRole[user.role].push(user)
    else byRole[user.role] = [user]
  }

  return NextResponse.json({ company, byRole })
}
