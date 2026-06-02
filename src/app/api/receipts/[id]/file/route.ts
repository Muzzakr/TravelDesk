import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return new NextResponse('Unauthorized', { status: 401 })

  const receipt = await prisma.receipt.findFirst({
    where: { id: params.id },
    include: { expense: { select: { companyId: true } } },
  })
  if (!receipt || receipt.expense.companyId !== session.user.companyId) {
    return new NextResponse('Not found', { status: 404 })
  }
  if (!receipt.fileData) {
    return new NextResponse('No file data', { status: 404 })
  }

  return new NextResponse(new Uint8Array(receipt.fileData as Buffer), {
    headers: {
      'Content-Type': receipt.mimeType,
      'Content-Disposition': `inline; filename="${receipt.fileName}"`,
    },
  })
}
