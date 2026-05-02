import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const MarkPaidSchema = z.object({ reportId: z.string() })

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const reports = await prisma.payoutReport.findMany({
    where: { companyId: session.user.companyId },
    include: {
      expenses: {
        select: {
          id: true,
          amountUsd: true,
          category: true,
          description: true,
          merchantName: true,
          transactionDate: true,
          employee: { select: { name: true } },
          event: { select: { eventName: true, eventCode: true } },
        },
      },
    },
    orderBy: { generatedAt: 'desc' },
  })
  return NextResponse.json(reports)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = MarkPaidSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const report = await prisma.payoutReport.findFirst({
    where: { id: parsed.data.reportId, companyId: session.user.companyId },
  })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (report.status === 'PAID') return NextResponse.json({ error: 'Report already marked as paid' }, { status: 409 })

  const updated = await prisma.payoutReport.update({
    where: { id: parsed.data.reportId },
    data: { status: 'PAID', paidAt: new Date() },
  })

  await prisma.expense.updateMany({
    where: { payoutReportId: parsed.data.reportId },
    data: { status: 'PAID' },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'PAYOUT_REPORT_MARKED_PAID',
    entityType: 'PayoutReport',
    entityId: parsed.data.reportId,
    payload: { paidAt: new Date().toISOString() },
  })

  return NextResponse.json(updated)
}
