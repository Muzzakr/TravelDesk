import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const logs = await prisma.auditLog.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { actor: { select: { name: true } } },
  })

  return NextResponse.json(logs)
}
