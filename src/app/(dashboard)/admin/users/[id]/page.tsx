import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Check } from 'lucide-react'

const roleBadge: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
  EMPLOYEE: 'blue',
  MANAGER: 'green',
  TRAVEL_AGENT: 'purple',
  FINANCE_ADMIN: 'yellow',
  SYSTEM_ADMIN: 'gray',
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

export default async function AdminUserProfilePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  if (session.user.role !== 'SYSTEM_ADMIN') redirect('/admin')

  const user = await prisma.user.findFirst({
    where: { id: params.id, companyId: session.user.companyId },
    select: {
      id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
      manager: { select: { name: true, email: true } },
      travelerProfile: true,
    },
  })

  if (!user) notFound()

  const profile = user.travelerProfile
  const airlineAccounts = (profile?.airlineAccounts as { airline: string; number: string }[] | null) ?? []

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-sm text-gray-400 hover:text-gray-600">← Users</Link>
      </div>

      {/* User header */}
      <div className="rounded-xl border bg-white p-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
          {user.manager && <p className="text-xs text-gray-400 mt-1">Manager: {user.manager.name}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={roleBadge[user.role] ?? 'gray'}>{user.role.replace(/_/g, ' ')}</Badge>
          <Badge variant={user.isActive ? 'green' : 'gray'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
      </div>

      {!profile ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-400">
          This user has not set up a traveler profile yet.
        </div>
      ) : (
        <>
          {/* Travel documents */}
          <section className="rounded-xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Travel documents</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Passport number</p>
                <p className="mt-1 text-gray-900">{profile.passportNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Passport expiry</p>
                <p className="mt-1 text-gray-900">{fmtDate(profile.passportExpiry)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Passport scan</p>
                <p className="mt-1">{profile.passportPhotoKey ? <span className="inline-flex items-center gap-1 text-green-600 font-medium"><Check className="w-3.5 h-3.5" /> On file</span> : <span className="text-gray-400">—</span>}</p>
              </div>
              <div></div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Driver&apos;s license</p>
                <p className="mt-1 text-gray-900">{profile.driversLicenseNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">License expiry</p>
                <p className="mt-1 text-gray-900">{fmtDate(profile.driversLicenseExpiry)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">License scan</p>
                <p className="mt-1">{profile.driversLicensePhotoKey ? <span className="inline-flex items-center gap-1 text-green-600 font-medium"><Check className="w-3.5 h-3.5" /> On file</span> : <span className="text-gray-400">—</span>}</p>
              </div>
            </div>
          </section>

          {/* Travel programs */}
          <section className="rounded-xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Travel programs</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">KTN (TSA PreCheck)</p>
                <p className="mt-1 text-gray-900">{profile.ktnNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Global Entry</p>
                <p className="mt-1 text-gray-900">{profile.globalEntryNumber ?? '—'}</p>
              </div>
            </div>
          </section>

          {/* Airline accounts */}
          {airlineAccounts.length > 0 && (
            <section className="rounded-xl border bg-white p-6 space-y-3">
              <h2 className="text-base font-semibold text-gray-800">Airline loyalty accounts</h2>
              <div className="space-y-2">
                {airlineAccounts.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5 text-sm">
                    <span className="font-medium text-gray-800">{a.airline}</span>
                    <span className="font-mono text-gray-600">{a.number}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
