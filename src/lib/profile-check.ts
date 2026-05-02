import { prisma } from '@/lib/prisma'

export type ProfileStatus = {
  complete: boolean
  missingFields: string[]
}

const ROLES_REQUIRING_PROFILE = ['EMPLOYEE', 'MANAGER', 'TRAVEL_AGENT']

export async function getProfileStatus(userId: string, role: string): Promise<ProfileStatus> {
  if (!ROLES_REQUIRING_PROFILE.includes(role)) {
    return { complete: true, missingFields: [] }
  }

  const profile = await prisma.travelerProfile.findUnique({
    where: { userId },
    select: { passportNumber: true, passportExpiry: true },
  })

  const missing: string[] = []
  if (!profile?.passportNumber) missing.push('Passport number')
  if (!profile?.passportExpiry) missing.push('Passport expiry date')

  return { complete: missing.length === 0, missingFields: missing }
}
