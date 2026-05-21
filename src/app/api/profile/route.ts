import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
  contactEmail: z.string().optional(),
  homeAddress: z.string().optional(),
  dateOfBirth: z.string().optional(),
  passportNumber: z.string().optional(),
  passportIssueDate: z.string().optional(),
  passportExpiry: z.string().optional(),
  driversLicenseNumber: z.string().optional(),
  driversLicenseIssueDate: z.string().optional(),
  driversLicenseExpiry: z.string().optional(),
  ktnNumber: z.string().optional(),
  globalEntryNumber: z.string().optional(),
  airlineAccounts: z.array(z.object({ airline: z.string(), number: z.string() })).optional(),
})

function toDate(val: string | undefined): Date | null {
  return val ? new Date(val) : null
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.travelerProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, companyId: session.user.companyId },
    update: {},
  })

  return NextResponse.json({ ...profile, userEmail: session.user.email })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const dateFields = {
    contactEmail: session.user.email,
    dateOfBirth: toDate(d.dateOfBirth),
    passportIssueDate: toDate(d.passportIssueDate),
    passportExpiry: toDate(d.passportExpiry),
    driversLicenseIssueDate: toDate(d.driversLicenseIssueDate),
    driversLicenseExpiry: toDate(d.driversLicenseExpiry),
  }

  const profile = await prisma.travelerProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, companyId: session.user.companyId, ...d, ...dateFields },
    update: { ...d, ...dateFields },
  })

  return NextResponse.json(profile)
}
