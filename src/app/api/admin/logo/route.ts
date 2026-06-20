import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadLogo } from '@/lib/storage'
import { writeAuditLog } from '@/lib/audit'

const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}
const MAX_BYTES = 2 * 1024 * 1024

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = ALLOWED_MIME[file.type]
  if (!ext) return NextResponse.json({ error: 'Only PNG, JPEG, SVG, or WebP are allowed' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 2 MB)' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  let logoUrl: string
  try {
    logoUrl = await uploadLogo(session.user.companyId, Buffer.from(bytes), file.type, ext)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  await prisma.company.update({
    where: { id: session.user.companyId },
    data: { logoUrl },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'COMPANY_LOGO_UPLOADED',
    entityType: 'Company',
    entityId: session.user.companyId,
    payload: {},
  })

  return NextResponse.json({ logoUrl })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.company.update({
    where: { id: session.user.companyId },
    data: { logoUrl: null },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'COMPANY_LOGO_REMOVED',
    entityType: 'Company',
    entityId: session.user.companyId,
    payload: {},
  })

  return NextResponse.json({ ok: true })
}
