import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdateSchema = z.object({
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional(),
  driversLicenseNumber: z.string().optional(),
  driversLicenseExpiry: z.string().optional(),
  ktnNumber: z.string().optional(),
  globalEntryNumber: z.string().optional(),
  airlineAccounts: z.array(z.object({ airline: z.string(), number: z.string() })).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.travelerProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, companyId: session.user.companyId },
    update: {},
  })

  return NextResponse.json(profile)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const profile = await prisma.travelerProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      companyId: session.user.companyId,
      ...d,
      passportExpiry: d.passportExpiry ? new Date(d.passportExpiry) : null,
      driversLicenseExpiry: d.driversLicenseExpiry ? new Date(d.driversLicenseExpiry) : null,
    },
    update: {
      ...d,
      passportExpiry: d.passportExpiry ? new Date(d.passportExpiry) : null,
      driversLicenseExpiry: d.driversLicenseExpiry ? new Date(d.driversLicenseExpiry) : null,
    },
  })

  return NextResponse.json(profile)
}
