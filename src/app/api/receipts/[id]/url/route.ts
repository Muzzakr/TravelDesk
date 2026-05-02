import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getReceiptUrl } from '@/lib/s3'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const receipt = await prisma.receipt.findFirst({
    where: { id: params.id },
    include: { expense: { select: { companyId: true } } },
  })
  if (!receipt || receipt.expense.companyId !== session.user.companyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = await getReceiptUrl(receipt.s3Key)
  return NextResponse.json({ url })
}
