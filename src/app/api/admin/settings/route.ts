import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const PatchSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { id: true, name: true, slug: true, plan: true, createdAt: true, webhookApiKey: true, logoUrl: true },
  })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const key = company.webhookApiKey
  return NextResponse.json({
    id:        company.id,
    name:      company.name,
    slug:      company.slug,
    plan:      company.plan,
    createdAt: company.createdAt,
    logoUrl:   company.logoUrl ?? null,
    webhookKey: key ? `••••••••••••${key.slice(-8)}` : null,
    hasWebhookKey: !!key,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updated = await prisma.company.update({
    where: { id: session.user.companyId },
    data: { name: parsed.data.name },
    select: { id: true, name: true, slug: true, plan: true },
  })

  return NextResponse.json(updated)
}