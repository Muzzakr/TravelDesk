import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { webhookApiKey: true },
  })

  const key = company?.webhookApiKey
  const masked = key ? `••••••••••••${key.slice(-8)}` : null

  return NextResponse.json({ masked, hasKey: !!key })
}
