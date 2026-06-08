import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { uploadReceipt, buildReceiptKey } from '@/lib/storage'

export const maxDuration = 60

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const expenseId = formData.get('expenseId') as string | null

  if (!file || !expenseId) {
    return NextResponse.json({ error: 'file and expenseId are required' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed. Use JPG, PNG, WebP or PDF.' }, { status: 415 })
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, companyId: session.user.companyId },
  })
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const s3Key = buildReceiptKey(session.user.companyId, expenseId, file.name)

  try {
    await uploadReceipt(s3Key, buffer, file.type)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const receipt = await prisma.receipt.create({
    data: {
      expenseId,
      s3Key,
      fileName: file.name,
      mimeType: file.type,
    },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'RECEIPT_UPLOADED',
    entityType: 'Receipt',
    entityId: receipt.id,
    payload: { expenseId, fileName: file.name },
  })

  return NextResponse.json(receipt, { status: 201 })
}
