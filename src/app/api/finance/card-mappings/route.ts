import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { notifyCardChargesAssigned } from '@/lib/card-notify'
import { z } from 'zod'

// One physical card (Card ID + Last Four) mapped once to the employee who
// carries it. The weekly statement export has no reliable employee email
// or ID, only this pair, so this mapping is what lets imports auto-assign
// an employee going forward — set once per card, reused every week.

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const mappings = await prisma.cardMapping.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { createdAt: 'desc' },
    include: { employee: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(mappings)
}

const MappingSchema = z.object({
  cardId: z.string().min(1),
  cardLastFour: z.string().min(1),
  employeeId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = MappingSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const employee = await prisma.user.findFirst({
    where: { id: parsed.data.employeeId, companyId: session.user.companyId },
    select: { id: true },
  })
  if (!employee) return NextResponse.json({ error: 'Invalid employeeId: user not found in this company' }, { status: 400 })

  const mapping = await prisma.cardMapping.upsert({
    where: {
      companyId_cardId_cardLastFour: {
        companyId: session.user.companyId,
        cardId: parsed.data.cardId,
        cardLastFour: parsed.data.cardLastFour,
      },
    },
    update: { employeeId: parsed.data.employeeId },
    create: {
      companyId: session.user.companyId,
      cardId: parsed.data.cardId,
      cardLastFour: parsed.data.cardLastFour,
      employeeId: parsed.data.employeeId,
    },
  })

  // Retroactive: any existing transaction from this card that was sitting
  // unassigned (imported before the card was ever mapped) gets the
  // employee applied now too, not just future imports.
  const retro = await prisma.cardTransaction.updateMany({
    where: {
      companyId: session.user.companyId,
      cardId: parsed.data.cardId,
      cardLastFour: parsed.data.cardLastFour,
      employeeId: null,
    },
    data: { employeeId: parsed.data.employeeId },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'CARD_MAPPING_SET',
    entityType: 'CardMapping',
    entityId: mapping.id,
    payload: { cardId: mapping.cardId, cardLastFour: mapping.cardLastFour, employeeId: mapping.employeeId, retroactiveCount: retro.count },
  })

  await notifyCardChargesAssigned(session.user.companyId, parsed.data.employeeId, retro.count)

  return NextResponse.json({ mapping, retroactiveCount: retro.count }, { status: 201 })
}
