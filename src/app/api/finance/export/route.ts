import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'SYSTEM_ADMIN'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const reportId = searchParams.get('reportId')

  const expenses = await prisma.expense.findMany({
    where: {
      companyId: session.user.companyId,
      ...(reportId ? { payoutReportId: reportId } : { status: 'PAID' }),
    },
    include: {
      employee: { select: { name: true, email: true } },
      event: { select: { eventName: true, eventCode: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const header = ['Date', 'Employee', 'Email', 'Category', 'Amount USD', 'Merchant', 'Event Code', 'Event Name', 'Status']
  const rows = expenses.map((e) => [
    e.transactionDate ? new Date(e.transactionDate).toISOString().slice(0, 10) : new Date(e.createdAt).toISOString().slice(0, 10),
    e.employee.name,
    e.employee.email,
    e.category,
    Number(e.amountUsd).toFixed(2),
    e.merchantName ?? '',
    e.event.eventCode,
    e.event.eventName,
    e.status,
  ])

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="expenses-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
