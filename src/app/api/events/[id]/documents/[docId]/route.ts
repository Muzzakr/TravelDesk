import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
