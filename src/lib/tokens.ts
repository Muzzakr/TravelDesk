import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export async function createVerificationToken(
  userId: string,
  type: 'INVITE' | 'PASSWORD_RESET' | 'GOOGLE_VERIFY' | 'EMAIL_VERIFY'
): Promise<string> {
  const raw = generateRawToken()
  const hoursValid = type === 'INVITE' ? 48 : type === 'GOOGLE_VERIFY' || type === 'EMAIL_VERIFY' ? 24 : 1
  const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000)

  // Remove any existing token of the same type for this user
  await prisma.verificationToken.deleteMany({ where: { userId, type } })

  await prisma.verificationToken.create({
    data: { token: hashToken(raw), userId, type, expiresAt },
  })

  return raw
}
