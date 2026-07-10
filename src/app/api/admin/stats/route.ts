import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getPeriodDates(period: string, startDate: string, endDate: string) {
  const now = new Date()
  let start: Date, end: Date

  if (period === 'weekly') {
    end = new Date(now)
    start = new Date(now)
    start.setDate(start.getDate() - 6)
  } else if (period === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  } else {
    start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1)
    end = endDate ? new Date(endDate) : now
  }

  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  const rangeMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - rangeMs)

  return { start, end, prevStart, prevEnd }
}

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function bucketByDay<T extends { createdAt: Date | string }>(items: T[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const item of items) {
    const day = fmtDate(new Date(item.createdAt))
    map[day] = (map[day] ?? 0) + 1
  }
  return map
}

function bucketExpenseByDay(items: { createdAt: Date | string; amountUsd: unknown }[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const item of items) {
    const day = fmtDate(new Date(item.createdAt))
    map[day] = (map[day] ?? 0) + Number(item.amountUsd)
  }
  return map
}

function fillDays(map: Record<string, number>, start: Date, end: Date, isAmount = false) {
  const result: { date: string; value: number }[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const d = fmtDate(cur)
    result.push({ date: d, value: isAmount ? Math.round((map[d] ?? 0) * 100) / 100 : (map[d] ?? 0) })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SYSTEM_ADMIN', 'MANAGER'].includes(session.user.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const companyId = session.user.companyId
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? 'monthly'
  const startDate = searchParams.get('startDate') ?? ''
  const endDate = searchParams.get('endDate') ?? ''
  const eventIdFilter = searchParams.get('eventId') ?? ''
  const employeeIdFilter = searchParams.get('employeeId') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = 25

  const { start, end, prevStart, prevEnd } = getPeriodDates(period, startDate, endDate)

  const [
    allRequests,
    prevRequests,
    allExpenses,
    prevExpenses,
    pendingRequestsRaw,
    pendingExpensesRaw,
    allUsers,
    allEvents,
    recordsRaw,
    recordsTotal,
  ] = await Promise.all([
    // Current period travel requests
    prisma.travelRequest.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { id: true, status: true, createdAt: true, origin: true, destination: true, estimatedCostUsd: true, employee: { select: { id: true, name: true } }, event: { select: { id: true, eventName: true, eventCode: true } } },
    }),
    // Previous period travel requests
    prisma.travelRequest.count({ where: { companyId, createdAt: { gte: prevStart, lte: prevEnd } } }),
    // Current period expenses
    prisma.expense.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { id: true, status: true, amountUsd: true, category: true, createdAt: true, employee: { select: { id: true, name: true } }, event: { select: { id: true, eventName: true, eventCode: true } }, merchantName: true },
    }),
    // Previous period expenses
    prisma.expense.findMany({
      where: { companyId, createdAt: { gte: prevStart, lte: prevEnd } },
      select: { amountUsd: true, status: true },
    }),
    // Pending approvals - travel requests
    prisma.travelRequest.findMany({
      where: { companyId, status: { in: ['PENDING_MANAGER', 'PENDING_AGENT', 'OPTIONS_PROVIDED', 'PENDING_ADMIN'] } },
      select: { id: true, status: true, createdAt: true, estimatedCostUsd: true, employee: { select: { name: true } }, event: { select: { eventName: true } } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
    // Pending approvals - expenses
    prisma.expense.findMany({
      where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      select: { id: true, status: true, amountUsd: true, createdAt: true, category: true, employee: { select: { name: true } }, event: { select: { eventName: true } } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
    // All users for ranking
    prisma.user.findMany({
      where: { companyId, role: 'EMPLOYEE' },
      select: { id: true, name: true },
    }),
    // All events for ranking
    prisma.event.findMany({
      where: { companyId },
      select: { id: true, eventName: true, eventCode: true, approvedSpendUsd: true },
      orderBy: { approvedSpendUsd: 'desc' },
      take: 5,
    }),
    // Detailed records (paginated)
    prisma.travelRequest.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { id: true, status: true, createdAt: true, origin: true, destination: true, estimatedCostUsd: true, employee: { select: { name: true } }, event: { select: { eventName: true, eventCode: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.travelRequest.count({ where: { companyId, createdAt: { gte: start, lte: end } } }),
  ])

  // Travel request stats
  const trApproved = allRequests.filter(r => ['APPROVED', 'BOOKING_CONFIRMED'].includes(r.status)).length
  const trPending = allRequests.filter(r => ['PENDING_MANAGER', 'PENDING_AGENT', 'OPTIONS_PROVIDED', 'PENDING_ADMIN'].includes(r.status)).length
  const trRejected = allRequests.filter(r => r.status === 'REJECTED').length
  const trByDayMap = bucketByDay(allRequests)
  const trByDay = fillDays(trByDayMap, start, end)

  // Expense stats
  const expApproved = allExpenses.filter(e => ['APPROVED', 'PAID'].includes(e.status)).length
  const expPending = allExpenses.filter(e => ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)).length
  const expRejected = allExpenses.filter(e => e.status === 'REJECTED').length
  const expTotalAmount = allExpenses.reduce((s, e) => s + Number(e.amountUsd), 0)
  const expApprovedAmount = allExpenses.filter(e => ['APPROVED', 'PAID'].includes(e.status)).reduce((s, e) => s + Number(e.amountUsd), 0)
  const prevExpTotal = prevExpenses.length
  const prevExpAmount = prevExpenses.filter(e => ['APPROVED', 'PAID'].includes(e.status)).reduce((s, e) => s + Number(e.amountUsd), 0)

  const expByDayMap = bucketExpenseByDay(allExpenses.filter(e => ['APPROVED', 'PAID'].includes(e.status)))
  const expByDay = fillDays(expByDayMap, start, end, true)

  // Category breakdown
  const catMap: Record<string, { count: number; amount: number }> = {}
  for (const e of allExpenses) {
    if (!catMap[e.category]) catMap[e.category] = { count: 0, amount: 0 }
    catMap[e.category].count++
    catMap[e.category].amount += Number(e.amountUsd)
  }
  const byCategory = Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, amount: Math.round(v.amount * 100) / 100 })).sort((a, b) => b.amount - a.amount)

  // Financial
  const travelCosts = allRequests.reduce((s, r) => s + Number(r.estimatedCostUsd ?? 0), 0)
  const expenseCosts = expApprovedAmount
  const combined = travelCosts + expenseCosts
  const prevTravelCosts = 0 // not tracked for prev period in this simplified version
  const prevCombined = prevExpAmount + prevTravelCosts

  // Pending approvals combined
  const pendingApprovals = [
    ...pendingRequestsRaw.map(r => ({
      id: r.id, employee: r.employee.name, type: 'Travel Request',
      amount: Number(r.estimatedCostUsd ?? 0), date: r.createdAt.toISOString(),
      status: r.status.replace(/_/g, ' '), href: `/manager/approvals/travel/${r.id}`,
      event: r.event.eventName,
    })),
    ...pendingExpensesRaw.map(e => ({
      id: e.id, employee: e.employee.name, type: 'Expense',
      amount: Number(e.amountUsd), date: e.createdAt.toISOString(),
      status: e.status.replace(/_/g, ' '), href: `/manager/approvals/expense/${e.id}`,
      event: e.event.eventName,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Rankings — top spending employees
  const empSpend: Record<string, { name: string; amount: number; requests: number; expenses: number }> = {}
  for (const e of allExpenses) {
    const id = e.employee.id
    if (!empSpend[id]) empSpend[id] = { name: e.employee.name, amount: 0, requests: 0, expenses: 0 }
    empSpend[id].amount += Number(e.amountUsd)
    empSpend[id].expenses++
  }
  for (const r of allRequests) {
    const id = r.employee.id
    if (!empSpend[id]) empSpend[id] = { name: r.employee.name, amount: 0, requests: 0, expenses: 0 }
    empSpend[id].requests++
  }
  const topEmployees = Object.entries(empSpend)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // Top destinations
  const destMap: Record<string, number> = {}
  for (const r of allRequests) {
    destMap[r.destination] = (destMap[r.destination] ?? 0) + 1
  }
  const topDestinations = Object.entries(destMap)
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Event analytics (if eventId provided)
  let eventAnalytics = null
  if (eventIdFilter) {
    const [evRequests, evExpenses, evEvent] = await Promise.all([
      prisma.travelRequest.count({ where: { companyId, eventId: eventIdFilter } }),
      prisma.expense.findMany({ where: { companyId, eventId: eventIdFilter }, select: { amountUsd: true, status: true, createdAt: true } }),
      prisma.event.findUnique({ where: { id: eventIdFilter }, select: { eventName: true, budgetUsd: true, approvedSpendUsd: true } }),
    ])
    const evExpTotal = evExpenses.reduce((s, e) => s + Number(e.amountUsd), 0)
    const evApproved = evExpenses.filter(e => ['APPROVED', 'PAID'].includes(e.status)).length
    eventAnalytics = {
      eventName: evEvent?.eventName,
      travelRequests: evRequests,
      expenses: evExpenses.length,
      totalExpenseCost: Math.round(evExpTotal * 100) / 100,
      budget: Number(evEvent?.budgetUsd ?? 0),
      approvedSpend: Number(evEvent?.approvedSpendUsd ?? 0),
      approvalRate: evExpenses.length > 0 ? Math.round((evApproved / evExpenses.length) * 100) : 0,
    }
  }

  // Employee analytics (if employeeId provided)
  let employeeAnalytics = null
  if (employeeIdFilter) {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)
    const [empRequests, empExpenses, empUser, empRequestCount, empExpenseAgg, empSpendRows] = await Promise.all([
      prisma.travelRequest.findMany({
        where: { companyId, employeeId: employeeIdFilter },
        select: { id: true, status: true, origin: true, destination: true, createdAt: true, estimatedCostUsd: true, event: { select: { eventName: true } } },
        orderBy: { createdAt: 'desc' }, take: 10,
      }),
      prisma.expense.findMany({
        where: { companyId, employeeId: employeeIdFilter },
        select: { id: true, status: true, amountUsd: true, category: true, createdAt: true, event: { select: { eventName: true } } },
        orderBy: { createdAt: 'desc' }, take: 10,
      }),
      prisma.user.findFirst({ where: { id: employeeIdFilter, companyId }, select: { name: true } }),
      prisma.travelRequest.count({ where: { companyId, employeeId: employeeIdFilter } }),
      prisma.expense.aggregate({
        where: { companyId, employeeId: employeeIdFilter },
        _count: true,
        _sum: { amountUsd: true },
      }),
      prisma.expense.findMany({
        where: { companyId, employeeId: employeeIdFilter, createdAt: { gte: sixMonthsAgo } },
        select: { amountUsd: true, createdAt: true },
      }),
    ])
    const monthlySpend: Record<string, number> = {}
    for (const e of empSpendRows) {
      const month = new Date(e.createdAt).toISOString().slice(0, 7)
      monthlySpend[month] = (monthlySpend[month] ?? 0) + Number(e.amountUsd)
    }
    employeeAnalytics = {
      employeeName: empUser?.name,
      totalRequests: empRequestCount,
      totalExpenses: empExpenseAgg._count,
      totalAmount: Math.round(Number(empExpenseAgg._sum.amountUsd ?? 0) * 100) / 100,
      monthlySpend: Object.entries(monthlySpend).map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 })).sort((a, b) => a.month.localeCompare(b.month)),
      recentRequests: empRequests,
      recentExpenses: empExpenses,
    }
  }

  return NextResponse.json({
    period: { start: start.toISOString(), end: end.toISOString() },
    travelRequests: {
      total: allRequests.length, approved: trApproved, pending: trPending, rejected: trRejected,
      previousTotal: prevRequests, byDay: trByDay,
    },
    expenses: {
      total: allExpenses.length, approved: expApproved, pending: expPending, rejected: expRejected,
      totalAmount: Math.round(expTotalAmount * 100) / 100,
      approvedAmount: Math.round(expApprovedAmount * 100) / 100,
      previousTotal: prevExpTotal, previousTotalAmount: Math.round(prevExpAmount * 100) / 100,
      byCategory, byDay: expByDay,
    },
    financial: {
      travelCosts: Math.round(travelCosts * 100) / 100,
      expenseCosts: Math.round(expenseCosts * 100) / 100,
      combined: Math.round(combined * 100) / 100,
      previousCombined: Math.round(prevCombined * 100) / 100,
    },
    pendingApprovals,
    records: { items: recordsRaw, total: recordsTotal, page, pageSize },
    rankings: {
      topEmployees,
      topEvents: allEvents.map(e => ({ id: e.id, name: e.eventName, code: e.eventCode, spend: Number(e.approvedSpendUsd) })),
      topDestinations,
      topCategories: byCategory.slice(0, 5),
    },
    eventAnalytics,
    employeeAnalytics,
  })
}
