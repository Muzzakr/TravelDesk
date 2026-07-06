import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/tokens'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const loginUrl = (params: string) => NextResponse.redirect(new URL(`/login?${params}`, req.url))

  // Token-guessing protection: 10 attempts per IP per 15 minutes
  if (!(await rateLimit(`verify-email:${clientIp(req)}`, 10, 15 * 60_000))) {
    return loginUrl('verify=expired')
  }

  const token = req.nextUrl.searchParams.get('token')
  if (!token) return loginUrl('verify=expired')

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(token) },
    include: { user: { select: { id: true, companyId: true, email: true, company: { select: { slug: true } } } } },
  })

  if (!record || record.type !== 'EMAIL_VERIFY' || record.expiresAt < new Date()) {
    return loginUrl('verify=expired')
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: { isActive: true },
  })
  await prisma.verificationToken.delete({ where: { id: record.id } })

  await writeAuditLog({
    companyId: record.user.companyId,
    actorId: record.userId,
    action: 'EMAIL_VERIFIED',
    entityType: 'User',
    entityId: record.userId,
    payload: { email: record.user.email },
  }).catch(() => {})

  return loginUrl(`verify=success&company=${record.user.company.slug}`)
}
