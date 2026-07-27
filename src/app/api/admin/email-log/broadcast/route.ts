import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { emailAnnouncement } from '@/lib/mail'
import { z } from 'zod'

const Schema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'TRAVEL_MANAGER', 'TRAVEL_AGENT', 'FINANCE_ADMIN', 'SYSTEM_ADMIN']).optional(),
})

// Admin-composed broadcast — the "system maintenance" / "important system
// update" trigger isn't automatic (no event to hook into), so it's a manual
// compose-and-send tool instead.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const recipients = await prisma.user.findMany({
    where: {
      companyId: session.user.companyId,
      isActive: true,
      ...(parsed.data.role && { role: parsed.data.role }),
    },
    select: { name: true, email: true },
  })

  let sent = 0
  for (const r of recipients) {
    if (!r.email) continue
    emailAnnouncement(r.email, r.name ?? 'there', {
      subject: parsed.data.subject, body: parsed.data.body,
    }, session.user.companyId).catch(() => {})
    sent++
  }

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'SYSTEM_ANNOUNCEMENT_SENT',
    entityType: 'Company',
    entityId: session.user.companyId,
    payload: { subject: parsed.data.subject, role: parsed.data.role ?? 'ALL', recipientCount: sent },
  })

  return NextResponse.json({ success: true, recipientCount: sent })
}
