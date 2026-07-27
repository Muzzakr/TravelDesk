import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const log = await prisma.emailLog.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(log)
}
