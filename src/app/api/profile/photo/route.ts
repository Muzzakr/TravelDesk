import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadReceipt } from '@/lib/s3'

type PhotoField = 'profilePhotoKey' | 'passportPhotoKey' | 'driversLicensePhotoKey'
const ALLOWED_FIELDS: PhotoField[] = ['profilePhotoKey', 'passportPhotoKey', 'driversLicensePhotoKey']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const field = formData.get('field') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!field || !ALLOWED_FIELDS.includes(field as PhotoField))
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const key = `profiles/${session.user.companyId}/${session.user.id}/${field}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  await uploadReceipt(key, Buffer.from(bytes), file.type)

  await prisma.travelerProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, companyId: session.user.companyId, [field]: key },
    update: { [field]: key },
  })

  return NextResponse.json({ key })
}
