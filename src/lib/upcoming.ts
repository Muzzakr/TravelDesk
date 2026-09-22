import { prisma } from '@/lib/prisma'
import { daysFromNow } from '@/lib/date-range'

export interface UpcomingItem {
  id: string
  type: 'trip' | 'event'
  title: string
  subtitle: string
  date: Date
}

/**
 * Merged "what's coming up" feed for the employer dashboards: active events
 * starting soon, and travel requests with an approved/confirmed departure
 * coming up. `travelDates` is a JSON field, so departure dates are filtered
 * and sorted in JS after a bounded fetch rather than in the Prisma `where`.
 */
export async function getUpcoming(companyId: string, windowDays = 30): Promise<UpcomingItem[]> {
  const now = new Date()
  const end = daysFromNow(windowDays, now)

  const [events, tripCandidates] = await Promise.all([
    prisma.event.findMany({
      where: { companyId, status: 'ACTIVE', dateStart: { gte: now, lte: end } },
      select: { id: true, eventName: true, eventCode: true, dateStart: true, venue: true },
      orderBy: { dateStart: 'asc' },
      take: 10,
    }),
    prisma.travelRequest.findMany({
      where: { companyId, status: { in: ['APPROVED', 'BOOKING_CONFIRMED'] } },
      select: { id: true, origin: true, destination: true, travelDates: true, employee: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
  ])

  const eventItems: UpcomingItem[] = events
    .filter((e): e is typeof e & { dateStart: Date } => e.dateStart !== null)
    .map((e) => ({ id: e.id, type: 'event', title: e.eventName, subtitle: e.venue || e.eventCode, date: e.dateStart }))

  const tripItems: UpcomingItem[] = tripCandidates
    .map((r): UpcomingItem | null => {
      const departureDate = (r.travelDates as { departureDate?: string } | null)?.departureDate
      if (!departureDate) return null
      const date = new Date(departureDate)
      if (isNaN(date.getTime()) || date < now || date > end) return null
      return { id: r.id, type: 'trip', title: `${r.origin} → ${r.destination}`, subtitle: r.employee.name, date }
    })
    .filter((item): item is UpcomingItem => item !== null)

  return [...eventItems, ...tripItems]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6)
}
