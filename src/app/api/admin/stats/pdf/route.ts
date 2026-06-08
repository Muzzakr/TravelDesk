import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function getPeriodDates(period: string, startDate: string, endDate: string) {
  const now = new Date()
  let start: Date, end: Date
  if (period === 'weekly') {
    end = new Date(now); start = new Date(now); start.setDate(start.getDate() - 6)
  } else if (period === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  } else {
    start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1)
    end = endDate ? new Date(endDate) : now
  }
  start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999)
  return { start, end }
}

function fmtUsd(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SYSTEM_ADMIN', 'MANAGER'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? 'monthly'
  const { start, end } = getPeriodDates(period, searchParams.get('startDate') ?? '', searchParams.get('endDate') ?? '')

  const [company, allRequests, allExpenses, pendingRequests, pendingExpenses, topEvents] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    prisma.travelRequest.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { status: true, estimatedCostUsd: true, employee: { select: { name: true } }, destination: true, event: { select: { eventName: true } } },
    }),
    prisma.expense.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { status: true, amountUsd: true, category: true, employee: { select: { name: true } }, event: { select: { eventName: true } } },
    }),
    prisma.travelRequest.findMany({
      where: { companyId, status: { in: ['PENDING_MANAGER', 'PENDING_AGENT', 'OPTIONS_PROVIDED'] } },
      select: { status: true, createdAt: true, estimatedCostUsd: true, employee: { select: { name: true } }, event: { select: { eventName: true } } },
      take: 20,
    }),
    prisma.expense.findMany({
      where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      select: { status: true, amountUsd: true, createdAt: true, category: true, employee: { select: { name: true } }, event: { select: { eventName: true } } },
      take: 20,
    }),
    prisma.event.findMany({
      where: { companyId },
      select: { eventName: true, approvedSpendUsd: true },
      orderBy: { approvedSpendUsd: 'desc' },
      take: 5,
    }),
  ])

  const trApproved = allRequests.filter(r => r.status === 'BOOKING_CONFIRMED').length
  const trPending = allRequests.filter(r => ['PENDING_MANAGER', 'PENDING_AGENT', 'OPTIONS_PROVIDED'].includes(r.status)).length
  const trRejected = allRequests.filter(r => r.status === 'REJECTED').length
  const expApproved = allExpenses.filter(e => ['APPROVED', 'PAID'].includes(e.status)).length
  const expPending = allExpenses.filter(e => ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)).length
  const expRejected = allExpenses.filter(e => e.status === 'REJECTED').length
  const expTotalAmount = allExpenses.reduce((s, e) => s + Number(e.amountUsd), 0)
  const travelCosts = allRequests.reduce((s, r) => s + Number(r.estimatedCostUsd ?? 0), 0)

  const catMap: Record<string, number> = {}
  for (const e of allExpenses) catMap[e.category] = (catMap[e.category] ?? 0) + Number(e.amountUsd)

  const empSpend: Record<string, number> = {}
  for (const e of allExpenses) empSpend[e.employee.name] = (empSpend[e.employee.name] ?? 0) + Number(e.amountUsd)

  // Build PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Title
  doc.setFontSize(20); doc.setTextColor(30, 30, 30)
  doc.text(`${company?.name ?? 'Company'} — Statistics Report`, 14, 20)
  doc.setFontSize(10); doc.setTextColor(120, 120, 120)
  doc.text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)} · ${start.toLocaleDateString('en-US')} – ${end.toLocaleDateString('en-US')}`, 14, 28)
  doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, 14, 34)

  let y = 42

  // KPI Summary
  doc.setFontSize(12); doc.setTextColor(30, 30, 30)
  doc.text('KPI Summary', 14, y); y += 6
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Total', 'Approved', 'Pending', 'Rejected']],
    body: [
      ['Travel Requests', allRequests.length, trApproved, trPending, trRejected],
      ['Expenses', allExpenses.length, expApproved, expPending, expRejected],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [99, 102, 241] },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // Financial
  doc.setFontSize(12); doc.text('Financial Overview', 14, y); y += 6
  autoTable(doc, {
    startY: y,
    body: [
      ['Travel Costs (estimated)', fmtUsd(travelCosts)],
      ['Expense Costs (total)', fmtUsd(expTotalAmount)],
      ['Combined Total', fmtUsd(travelCosts + expTotalAmount)],
    ],
    styles: { fontSize: 9 },
  })
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // Pending Approvals
  if (pendingRequests.length > 0 || pendingExpenses.length > 0) {
    doc.setFontSize(12); doc.text('Pending Approvals', 14, y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['Employee', 'Type', 'Event', 'Amount', 'Status']],
      body: [
        ...pendingRequests.map(r => [r.employee.name, 'Travel Request', r.event.eventName, r.estimatedCostUsd ? fmtUsd(Number(r.estimatedCostUsd)) : '—', r.status.replace(/_/g, ' ')]),
        ...pendingExpenses.map(e => [e.employee.name, 'Expense', e.event.eventName, fmtUsd(Number(e.amountUsd)), e.status.replace(/_/g, ' ')]),
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [245, 158, 11] },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // Top Employees
  const topEmpEntries = Object.entries(empSpend).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (topEmpEntries.length > 0) {
    if (y > 230) { doc.addPage(); y = 20 }
    doc.setFontSize(12); doc.text('Top Spending Employees', 14, y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['#', 'Employee', 'Total Spend']],
      body: topEmpEntries.map(([name, amount], i) => [i + 1, name, fmtUsd(amount)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // Top Events
  if (topEvents.length > 0) {
    if (y > 230) { doc.addPage(); y = 20 }
    doc.setFontSize(12); doc.text('Most Expensive Events', 14, y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['#', 'Event', 'Approved Spend']],
      body: topEvents.map((e, i) => [i + 1, e.eventName, fmtUsd(Number(e.approvedSpendUsd))]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // Top Categories
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (catEntries.length > 0) {
    if (y > 230) { doc.addPage(); y = 20 }
    doc.setFontSize(12); doc.text('Top Expense Categories', 14, y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['#', 'Category', 'Total Amount']],
      body: catEntries.map(([cat, amount], i) => [i + 1, cat.replace(/_/g, ' '), fmtUsd(amount)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [139, 92, 246] },
    })
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="stats-${new Date().toISOString().slice(0,10)}.pdf"`,
    },
  })
}
