import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const managers = await prisma.user.findMany({
    where: {
      companyId: session.user.companyId,
      role: { in: ['MANAGER', 'TRAVEL_MANAGER'] },
      isActive: true,
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(managers)
}
