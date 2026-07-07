import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/tokens'

/** Human-friendly one-time code, e.g. "3F9A-C21B". */
function generateCode(): string {
  const hex = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4)}`
}

/**
 * Replace the user's backup codes with a fresh set of 10.
 * Returns the plaintext codes — shown to the user ONCE, only hashes are stored.
 */
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: 10 }, generateCode)
  await prisma.$transaction([
    prisma.mfaBackupCode.deleteMany({ where: { userId } }),
    prisma.mfaBackupCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashToken(code) })),
    }),
  ])
  return codes
}

/** Consume a backup code — returns true and marks it used if it matches an unused one. */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase().replace(/\s/g, '')
  const match = await prisma.mfaBackupCode.findFirst({
    where: { userId, codeHash: hashToken(normalized), usedAt: null },
  })
  if (!match) return false
  await prisma.mfaBackupCode.update({
    where: { id: match.id },
    data: { usedAt: new Date() },
  })
  return true
}

export async function deleteBackupCodes(userId: string): Promise<void> {
  await prisma.mfaBackupCode.deleteMany({ where: { userId } })
}
