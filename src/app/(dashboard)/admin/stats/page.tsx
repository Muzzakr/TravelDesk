import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import StatsDashboard from '@/components/ui/StatsDashboard'

export default async function StatsPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  if (!['SYSTEM_ADMIN', 'MANAGER'].includes(session.user.role ?? '')) redirect('/login')

  const companyId = session.user.companyId

  const [events, employees] = await Promise.all([
    prisma.event.findMany({
      where: { companyId },
      select: { id: true, eventName: true, eventCode: true },
      orderBy: [{ eventDate: 'desc' }, { eventCode: 'asc' }],
    }),
    prisma.user.findMany({
      where: { companyId, role: 'EMPLOYEE', isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return <StatsDashboard events={events} employees={employees} />
}
