import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getProfilePhotoUrl } from '@/lib/storage'

const ALLOWED_FIELDS = ['profilePhotoKey', 'passportPhotoKey', 'driversLicensePhotoKey'] as const
type PhotoField = (typeof ALLOWED_FIELDS)[number]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const field = req.nextUrl.searchParams.get('field') as PhotoField | null
  if (!field || !ALLOWED_FIELDS.includes(field))
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })

  const profile = await prisma.travelerProfile.findUnique({
    where: { userId: session.user.id },
    select: { [field]: true },
  })

  const key = profile?.[field] as string | null | undefined
  if (!key) return NextResponse.json({ url: null })

  const url = await getProfilePhotoUrl(key)
  return NextResponse.json({ url })
}
