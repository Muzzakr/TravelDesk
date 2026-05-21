import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['TRAVEL_AGENT', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const confirmation = await prisma.bookingConfirmation.findUnique({
    where: { id: params.id },
    include: { travelRequest: { select: { companyId: true } } },
  })
  if (!confirmation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (confirmation.travelRequest.companyId !== session.user.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  await prisma.bookingConfirmation.update({
    where: { id: params.id },
    data: {
      fileName: file.name,
      fileData: buffer,
      mimeType: file.type || 'application/octet-stream',
    },
  })

  return NextResponse.json({ success: true })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const confirmation = await prisma.bookingConfirmation.findUnique({
    where: { id: params.id },
    include: { travelRequest: { select: { companyId: true } } },
  })
  if (!confirmation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (confirmation.travelRequest.companyId !== session.user.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!confirmation.fileData) return NextResponse.json({ error: 'No file' }, { status: 404 })

  return new NextResponse(confirmation.fileData, {
    headers: {
      'Content-Type': confirmation.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${confirmation.fileName ?? 'document'}"`,
    },
  })
}
