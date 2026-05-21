import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadProfilePhoto, buildProfilePhotoKey } from '@/lib/storage'

type PhotoField = 'profilePhotoKey' | 'passportPhotoKey' | 'driversLicensePhotoKey'
const ALLOWED_FIELDS: PhotoField[] = ['profilePhotoKey', 'passportPhotoKey', 'driversLicensePhotoKey']
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const field = formData.get('field') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!field || !ALLOWED_FIELDS.includes(field as PhotoField))
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  if (!ALLOWED_MIME.includes(file.type))
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or PDF files are allowed' }, { status: 400 })
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const key = buildProfilePhotoKey(session.user.companyId, session.user.id, field, file.name)

  try {
    await uploadProfilePhoto(key, Buffer.from(bytes), file.type)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  await prisma.travelerProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, companyId: session.user.companyId, [field]: key },
    update: { [field]: key },
  })

  return NextResponse.json({ key })
}
