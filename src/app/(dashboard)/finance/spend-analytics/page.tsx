export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SpendChart } from '@/components/ui/SpendChart'

export default async function SpendAnalyticsPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  if (!['FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(session.user.role ?? '')) redirect('/finance')

  const events = await prisma.event.findMany({
    where: { companyId: session.user.companyId },
    select: { id: true, eventName: true },
    orderBy: { eventName: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Spend Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Approved expense spend over time</p>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <SpendChart companyEvents={events.map(e => ({ id: e.id, eventName: e.eventName }))} />
      </div>
    </div>
  )
}
