import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailFinanceDigest } from '@/lib/mail'

// Daily digest: emails each company's finance admins a summary of all expenses
// approved in the last 24 hours that are still awaiting payout.
export async function GET(req: NextRequest) {
  // Verify cron secret (same scheme as monthly-report)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const companies = await prisma.company.findMany({ select: { id: true } })

  let emailsSent = 0
  let companiesNotified = 0

  for (const company of companies) {
    const companyId = company.id

    // Expenses approved in the last 24h (via ApprovalAction, so re-runs don't resend)
    const approvals = await prisma.approvalAction.findMany({
      where: { companyId, actionType: 'APPROVE', createdAt: { gte: since }, expenseId: { not: null } },
      select: { expenseId: true },
    })
    const expenseIds = [...new Set(approvals.map((a) => a.expenseId).filter((x): x is string => !!x))]
    if (expenseIds.length === 0) continue

    // Only those still APPROVED (not yet paid)
    const expenses = await prisma.expense.findMany({
      where: { id: { in: expenseIds }, status: 'APPROVED' },
      include: {
        employee: { select: { name: true } },
        event: { select: { eventCode: true } },
      },
    })
    if (expenses.length === 0) continue

    const financeAdmins = await prisma.user.findMany({
      where: { companyId, role: 'FINANCE_ADMIN', isActive: true },
      select: { name: true, email: true },
    })
    if (financeAdmins.length === 0) continue

    const items = expenses.map((e) => ({
      employeeName: e.employee.name ?? 'Employee',
      amountUsd: Number(e.amountUsd),
      category: e.category,
      eventCode: e.event?.eventCode ?? '',
    }))
    const totalUsd = items.reduce((s, i) => s + i.amountUsd, 0)

    for (const fa of financeAdmins) {
      if (!fa.email) continue
      await emailFinanceDigest(fa.email, fa.name ?? 'there', {
        items,
        totalUsd,
        count: items.length,
      }).catch((err) => console.error(`[cron] finance digest email failed for ${fa.email}:`, err))
      emailsSent++
    }
    companiesNotified++
  }

  return NextResponse.json({ success: true, emailsSent, companiesNotified })
}
