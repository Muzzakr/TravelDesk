import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

export const maxDuration = 60

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'text/csv',
]

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const event = await prisma.event.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const docs = await prisma.eventDocument.findMany({
    where: { eventId: params.id },
    select: { id: true, fileName: true, mimeType: true, uploadedAt: true, uploader: { select: { name: true } } },
    orderBy: { uploadedAt: 'desc' },
  })

  return NextResponse.json(docs)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const event = await prisma.event.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'File type not allowed' }, { status: 415 })

  const buffer = Buffer.from(await file.arrayBuffer())

  const doc = await prisma.eventDocument.create({
    data: {
      eventId: params.id,
      uploadedBy: session.user.id,
      fileName: file.name,
      mimeType: file.type,
      fileData: buffer,
    },
    select: { id: true, fileName: true, mimeType: true, uploadedAt: true },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'EVENT_DOCUMENT_UPLOADED',
    entityType: 'Event',
    entityId: params.id,
    payload: { fileName: file.name },
  })

  return NextResponse.json(doc, { status: 201 })
}
