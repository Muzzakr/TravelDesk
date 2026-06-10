import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ notifications: [] })

  const companyId = session.user.companyId
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [pendingTravel, pendingExpenses, recentBookings, recentPaid] = await Promise.all([
    prisma.travelRequest.findMany({
      where: { companyId, status: 'PENDING_MANAGER' },
      select: { id: true, origin: true, destination: true, createdAt: true, employee: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.expense.findMany({
      where: { companyId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      select: { id: true, description: true, amountUsd: true, createdAt: true, employee: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.travelRequest.findMany({
      where: { companyId, status: 'BOOKING_CONFIRMED', updatedAt: { gte: sevenDaysAgo } },
      select: { id: true, origin: true, destination: true, updatedAt: true, employee: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    prisma.expense.findMany({
      where: { companyId, status: 'PAID', updatedAt: { gte: sevenDaysAgo } },
      select: { id: true, description: true, amountUsd: true, updatedAt: true, employee: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
  ])

  function timeAgo(date: Date): string {
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const notifications = [
    ...pendingTravel.map((t) => ({
      id: `tr-${t.id}`,
      type: 'travel_pending' as const,
      title: 'New travel request awaiting review',
      description: `${t.employee.name} · ${t.origin} → ${t.destination}`,
      href: `/manager/approvals/travel/${t.id}`,
      time: timeAgo(t.createdAt),
      read: false,
    })),
    ...pendingExpenses.map((e) => ({
      id: `ex-${e.id}`,
      type: 'expense_pending' as const,
      title: 'Expense awaiting approval',
      description: `${e.employee.name} · ${e.description} · $${Number(e.amountUsd).toFixed(0)}`,
      href: `/manager/approvals/expense/${e.id}`,
      time: timeAgo(e.createdAt),
      read: false,
    })),
    ...recentBookings.map((t) => ({
      id: `bk-${t.id}`,
      type: 'travel_booked' as const,
      title: 'Travel booked',
      description: `${t.employee.name} · ${t.origin} → ${t.destination}`,
      href: `/manager/approvals/travel/${t.id}`,
      time: timeAgo(t.updatedAt),
      read: true,
    })),
    ...recentPaid.map((e) => ({
      id: `pd-${e.id}`,
      type: 'expense_paid' as const,
      title: 'Expense paid',
      description: `${e.employee.name} · ${e.description} · $${Number(e.amountUsd).toFixed(0)}`,
      href: `/manager/approvals/expense/${e.id}`,
      time: timeAgo(e.updatedAt),
      read: true,
    })),
  ]

  return NextResponse.json({ notifications })
}
