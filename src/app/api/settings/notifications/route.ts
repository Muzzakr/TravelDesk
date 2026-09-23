import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { personalEmailTypeGroups, PERSONAL_EMAIL_TYPES } from '@/lib/email-types'
import { z } from 'zod'

// Personal email-notification preferences for the signed-in user — any role.
// This sits on top of the company-wide toggles at /admin/emails: an admin
// gates a type for everyone, this lets one person additionally mute it for
// themselves (see UserNotificationSetting, checked in src/lib/email.ts).
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const overrides = await prisma.userNotificationSetting.findMany({
    where: { userId: session.user.id },
    select: { type: true, enabled: true },
  })
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.type, o.enabled]))

  const groups = personalEmailTypeGroups().map((g) => ({
    group: g.group,
    types: g.types.map((t) => ({ type: t.type, label: t.label, enabled: overrideMap[t.type] ?? true })),
  }))

  return NextResponse.json(groups)
}

const PatchSchema = z.object({
  type: z.string().min(1),
  enabled: z.boolean(),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!PERSONAL_EMAIL_TYPES.has(parsed.data.type)) {
    return NextResponse.json({ error: 'This notification type cannot be personally muted' }, { status: 400 })
  }

  const setting = await prisma.userNotificationSetting.upsert({
    where: { userId_type: { userId: session.user.id, type: parsed.data.type } },
    create: { userId: session.user.id, type: parsed.data.type, enabled: parsed.data.enabled },
    update: { enabled: parsed.data.enabled },
  })

  return NextResponse.json(setting)
}
