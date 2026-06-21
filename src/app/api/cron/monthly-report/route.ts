import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createTransport } from 'nodemailer'

const transporter = createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
})
const FROM = `"M4U Travel" <${process.env.GMAIL_USER}>`

function baseTemplate(content: string) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:32px 16px">
      <div style="background:#4f46e5;border-radius:12px 12px 0 0;padding:24px 32px">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">M4U Travel — Monthly Report</h1>
      </div>
      <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e5e7eb;border-top:none">
        ${content}
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">M4U Travel — automated monthly report.</p>
    </div>
  `
}

function statRow(label: string, value: string | number) {
  return `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">${label}</td><td style="padding:6px 0;font-weight:600;font-size:14px;text-align:right">${value}</td></tr>`
}

function section(title: string, rows: string) {
  return `
    <h3 style="color:#1f2937;font-size:15px;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid #e5e7eb">${title}</h3>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
  `
}

function trendArrow(current: number, previous: number) {
  if (previous === 0) return ''
  const pct = Math.round(((current - previous) / previous) * 100)
  return pct >= 0
    ? `<span style="color:#059669">↑ ${pct}%</span>`
    : `<span style="color:#dc2626">↓ ${Math.abs(pct)}%</span>`
}

function fmtUsd(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  // Previous month
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  // Month before previous (for trend)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59)
  const monthLabel = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Fetch all companies
  const companies = await prisma.company.findMany({ select: { id: true, name: true } })

  let totalEmailsSent = 0

  for (const company of companies) {
    const companyId = company.id

    // Fetch recipients (SYSTEM_ADMIN + MANAGER + TRAVEL_MANAGER + FINANCE_ADMIN)
    const recipients = await prisma.user.findMany({
      where: { companyId, role: { in: ['SYSTEM_ADMIN', 'MANAGER', 'TRAVEL_MANAGER', 'FINANCE_ADMIN'] }, isActive: true },
      select: { email: true, name: true, role: true },
    })
    if (recipients.length === 0) continue

    const [
      allRequests, prevRequests,
      allExpenses, prevExpenses,
      pendingCount,
    ] = await Promise.all([
      prisma.travelRequest.findMany({
        where: { companyId, createdAt: { gte: start, lte: end } },
        select: { status: true, estimatedCostUsd: true },
      }),
      prisma.travelRequest.count({ where: { companyId, createdAt: { gte: prevStart, lte: prevEnd } } }),
      prisma.expense.findMany({
        where: { companyId, createdAt: { gte: start, lte: end } },
        select: { status: true, amountUsd: true },
      }),
      prisma.expense.findMany({
        where: { companyId, createdAt: { gte: prevStart, lte: prevEnd } },
        select: { status: true, amountUsd: true },
      }),
      prisma.travelRequest.count({
        where: { companyId, status: { in: ['PENDING_MANAGER', 'PENDING_AGENT', 'OPTIONS_PROVIDED'] } },
      }),
    ])

    const trTotal = allRequests.length
    const trApproved = allRequests.filter(r => r.status === 'BOOKING_CONFIRMED').length
    const trPending = allRequests.filter(r => ['PENDING_MANAGER', 'PENDING_AGENT', 'OPTIONS_PROVIDED'].includes(r.status)).length
    const trRejected = allRequests.filter(r => r.status === 'REJECTED').length

    const expTotal = allExpenses.length
    const expApproved = allExpenses.filter(e => ['APPROVED', 'PAID'].includes(e.status)).length
    const expPending = allExpenses.filter(e => ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)).length
    const expRejected = allExpenses.filter(e => e.status === 'REJECTED').length
    const expAmount = allExpenses.reduce((s, e) => s + Number(e.amountUsd), 0)
    const travelCosts = allRequests.reduce((s, r) => s + Number(r.estimatedCostUsd ?? 0), 0)

    const prevExpTotal = prevExpenses.length
    const prevExpAmount = prevExpenses.filter(e => ['APPROVED', 'PAID'].includes(e.status)).reduce((s, e) => s + Number(e.amountUsd), 0)
    const prevCombined = prevExpAmount

    const html = baseTemplate(`
      <h2 style="color:#1f2937;font-size:18px;margin:0 0 4px">${company.name}</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Monthly summary for <strong>${monthLabel}</strong></p>

      ${section('Travel Requests', [
        statRow('Total Submitted', trTotal),
        statRow('Approved', trApproved),
        statRow('Pending', trPending),
        statRow('Rejected', trRejected),
      ].join(''))}

      ${section('Expenses', [
        statRow('Total Submitted', expTotal),
        statRow('Approved', expApproved),
        statRow('Pending', expPending),
        statRow('Rejected', expRejected),
      ].join(''))}

      ${section('Financial Summary', [
        statRow('Travel Costs (est.)', fmtUsd(travelCosts)),
        statRow('Expense Costs', fmtUsd(expAmount)),
        statRow('Combined Total', fmtUsd(travelCosts + expAmount)),
      ].join(''))}

      ${section('Trends vs Previous Month', [
        statRow('Travel Requests', `${trTotal} ${trendArrow(trTotal, prevRequests)}`),
        statRow('Expenses', `${expTotal} ${trendArrow(expTotal, prevExpTotal)}`),
        statRow('Total Costs', `${fmtUsd(travelCosts + expAmount)} ${trendArrow(travelCosts + expAmount, prevCombined)}`),
      ].join(''))}

      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-top:24px">
        <p style="margin:0;font-size:14px;color:#92400e">
          <strong>${pendingCount}</strong> travel request${pendingCount !== 1 ? 's' : ''} still pending approval.
        </p>
      </div>

      <p style="margin:24px 0 0">
        <a href="__REPORT_HREF__" style="background:#4f46e5;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Full Report →</a>
      </p>
    `)

    const baseUrl = process.env.NEXTAUTH_URL ?? ''
    const reportHrefByRole: Record<string, string> = {
      SYSTEM_ADMIN: `${baseUrl}/admin/stats`,
      FINANCE_ADMIN: `${baseUrl}/finance/reports`,
      MANAGER: `${baseUrl}/manager/reports`,
      TRAVEL_MANAGER: `${baseUrl}/manager/reports`,
    }

    for (const recipient of recipients) {
      const reportHref = reportHrefByRole[recipient.role] ?? `${baseUrl}/manager/reports`
      const personalHtml = html.replace('__REPORT_HREF__', reportHref)
      await transporter.sendMail({
        from: FROM,
        to: recipient.email,
        subject: `Monthly Report — ${monthLabel} · ${company.name}`,
        html: personalHtml,
      }).catch(err => console.error(`[cron] email failed for ${recipient.email}:`, err))
      totalEmailsSent++
    }
  }

  return NextResponse.json({ success: true, emailsSent: totalEmailsSent, month: monthLabel })
}
