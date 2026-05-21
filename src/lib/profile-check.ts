import { prisma } from '@/lib/prisma'

export type ProfileStatus = {
  complete: boolean
  missingFields: string[]
  blocking: boolean
}

export async function getProfileStatus(userId: string, role: string): Promise<ProfileStatus> {
  if (role !== 'EMPLOYEE') {
    return { complete: true, missingFields: [], blocking: false }
  }

  const profile = await prisma.travelerProfile.findUnique({
    where: { userId },
    select: {
      firstName: true,
      lastName: true,
      phoneNumber: true,
      passportNumber: true,
      passportExpiry: true,
    },
  })

  const missing: string[] = []
  if (!profile?.firstName)      missing.push('First name')
  if (!profile?.lastName)       missing.push('Last name')
  if (!profile?.phoneNumber)    missing.push('Phone number')
  if (!profile?.passportNumber) missing.push('Passport number')
  if (!profile?.passportExpiry) missing.push('Passport expiry date')

  return {
    complete: missing.length === 0,
    missingFields: missing,
    blocking: missing.length > 0,
  }
}
