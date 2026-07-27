import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { emailDocumentRemoved } from '@/lib/mail'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const doc = await prisma.eventDocument.findFirst({
    where: { id: params.docId, eventId: params.id, event: { companyId: session.user.companyId } },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const base64 = doc.fileData.toString('base64')
  return NextResponse.json({
    url: `data:${doc.mimeType};base64,${base64}`,
    fileName: doc.fileName,
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const doc = await prisma.eventDocument.findFirst({
    where: { id: params.docId, eventId: params.id, event: { companyId: session.user.companyId } },
    include: { event: { select: { eventName: true, ownerUserId: true } } },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.eventDocument.delete({ where: { id: params.docId } })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'EVENT_DOCUMENT_REMOVED',
    entityType: 'Event',
    entityId: params.id,
    payload: { fileName: doc.fileName, documentType: doc.documentType },
  })

  const owner = await prisma.user.findUnique({ where: { id: doc.event.ownerUserId }, select: { name: true, email: true } })
  if (owner?.email) {
    emailDocumentRemoved(owner.email, owner.name ?? 'there', {
      eventName: doc.event.eventName, fileName: doc.fileName, eventId: params.id,
    }, session.user.companyId).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
