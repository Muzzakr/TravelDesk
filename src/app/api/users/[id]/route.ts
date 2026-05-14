import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const ALLOWED_ROLES = ['SYSTEM_ADMIN', 'MANAGER'] as const

const PatchSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'TRAVEL_AGENT', 'FINANCE_ADMIN', 'SYSTEM_ADMIN']).optional(),
  managerId: z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { companyId: true },
  })
  if (!target || target.companyId !== session.user.companyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'USER_UPDATED',
    entityType: 'User',
    entityId: params.id,
    payload: parsed.data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(session.user.role as typeof ALLOWED_ROLES[number]))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (params.id === session.user.id)
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })

  const user = await prisma.user.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await prisma.user.delete({ where: { id: params.id } })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'USER_DELETED',
    entityType: 'User',
    entityId: params.id,
    payload: { email: user.email, name: user.name },
  })

  return NextResponse.json({ ok: true })
}
