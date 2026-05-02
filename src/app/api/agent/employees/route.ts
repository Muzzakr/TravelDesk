import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'TRAVEL_AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const employees = await prisma.user.findMany({
    where: {
      companyId: session.user.companyId,
      isActive: true,
      role: { in: ['EMPLOYEE', 'MANAGER'] },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(employees)
}
