import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const Schema = z.object({
  passportNumber: z.string().nullable().optional(),
  passportExpiry: z.string().nullable().optional(),
  driversLicenseNumber: z.string().nullable().optional(),
  driversLicenseExpiry: z.string().nullable().optional(),
  ktnNumber: z.string().nullable().optional(),
  globalEntryNumber: z.string().nullable().optional(),
  loyaltyAccounts: z.array(z.object({ airline: z.string(), number: z.string() })).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await prisma.user.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { loyaltyAccounts, ...docFields } = parsed.data

  const data: Record<string, unknown> = {}
  if (docFields.passportNumber !== undefined) data.passportNumber = docFields.passportNumber
  if (docFields.passportExpiry !== undefined) data.passportExpiry = docFields.passportExpiry ? new Date(docFields.passportExpiry) : null
  if (docFields.driversLicenseNumber !== undefined) data.driversLicenseNumber = docFields.driversLicenseNumber
  if (docFields.driversLicenseExpiry !== undefined) data.driversLicenseExpiry = docFields.driversLicenseExpiry ? new Date(docFields.driversLicenseExpiry) : null
  if (docFields.ktnNumber !== undefined) data.ktnNumber = docFields.ktnNumber
  if (docFields.globalEntryNumber !== undefined) data.globalEntryNumber = docFields.globalEntryNumber
  if (loyaltyAccounts !== undefined) data.airlineAccounts = loyaltyAccounts

  await prisma.travelerProfile.upsert({
    where: { userId: params.id },
    update: data,
    create: { userId: params.id, companyId: session.user.companyId, ...data },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'ADMIN_TRAVEL_DOCS_UPDATED',
    entityType: 'TravelerProfile',
    entityId: params.id,
    payload: { targetUser: user.email, fields: Object.keys(data) },
  })

  return NextResponse.json({ ok: true })
}
