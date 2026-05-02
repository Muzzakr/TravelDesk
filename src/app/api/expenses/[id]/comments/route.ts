import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const expense = await prisma.expense.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { body } = await req.json()
  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const comment = await prisma.comment.create({
    data: {
      expenseId: params.id,
      authorId: session.user.id,
      body: body.trim(),
    },
  })

  return NextResponse.json(comment, { status: 201 })
}
