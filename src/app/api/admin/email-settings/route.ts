import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { EMAIL_TYPE_GROUPS } from '@/lib/email-types'
import { z } from 'zod'

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const settings = await prisma.emailNotificationSetting.findMany({
    where: { companyId: session.user.companyId },
    select: { type: true, enabled: true },
  })
  const settingsMap = Object.fromEntries(settings.map((s) => [s.type, s.enabled]))

  // Absence of a row means enabled — merge the known type list with any
  // explicit overrides so the UI always shows every type, defaulted on.
  const groups = EMAIL_TYPE_GROUPS.map((g) => ({
    group: g.group,
    types: g.types.map((t) => ({ ...t, enabled: settingsMap[t.type] ?? true })),
  }))

  return NextResponse.json(groups)
}

const PatchSchema = z.object({
  type: z.string().min(1),
  enabled: z.boolean(),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const setting = await prisma.emailNotificationSetting.upsert({
    where: { companyId_type: { companyId: session.user.companyId, type: parsed.data.type } },
    create: { companyId: session.user.companyId, type: parsed.data.type, enabled: parsed.data.enabled },
    update: { enabled: parsed.data.enabled },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'EMAIL_NOTIFICATION_SETTING_CHANGED',
    entityType: 'EmailNotificationSetting',
    entityId: setting.id,
    payload: { type: parsed.data.type, enabled: parsed.data.enabled },
  })

  return NextResponse.json(setting)
}
