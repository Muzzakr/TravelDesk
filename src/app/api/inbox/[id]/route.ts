import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const PatchSchema = z.object({
  status:          z.enum(['NEW', 'IN_PROGRESS', 'DONE', 'IGNORED']).optional(),
  assignedToId:    z.string().optional(),
  travelRequestId: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['TRAVEL_AGENT', 'MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const message = await prisma.travelInboxMessage.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.travelInboxMessage.update({
    where: { id: params.id },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}
