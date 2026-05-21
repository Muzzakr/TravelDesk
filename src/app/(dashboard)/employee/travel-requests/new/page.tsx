export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getProfileStatus } from '@/lib/profile-check'
import { prisma } from '@/lib/prisma'
import { TravelRequestForm } from './TravelRequestForm'
import Link from 'next/link'

export default async function NewTravelRequestPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [status, profile] = await Promise.all([
    getProfileStatus(session.user.id, session.user.role ?? ''),
    prisma.travelerProfile.findUnique({
      where: { userId: session.user.id },
      select: { driversLicenseNumber: true, driversLicenseExpiry: true },
    }),
  ])

  if (!status.complete) {
    return (
      <div className="mx-auto max-w-md mt-12 rounded-xl bg-white p-8 shadow-sm text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Complete your profile first</h1>
        <p className="text-sm text-gray-500">Your travel agent needs this information to book your trip.</p>
        <ul className="text-sm text-left space-y-1.5 text-gray-700 inline-block">
          {status.missingFields.map(f => (
            <li key={f} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        <Link
          href="/employee/profile"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Go to my profile →
        </Link>
      </div>
    )
  }

  const hasDriversLicense = !!(profile?.driversLicenseNumber && profile?.driversLicenseExpiry)

  return <TravelRequestForm hasDriversLicense={hasDriversLicense} />
}
