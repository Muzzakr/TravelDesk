import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const SignupSchema = z.object({
  companyName: z.string().min(2),
  companySlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug: lowercase letters, numbers, hyphens only'),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = SignupSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const slugTaken = await prisma.company.findUnique({ where: { slug: parsed.data.companySlug } })
  if (slugTaken) return NextResponse.json({ error: 'Company slug already taken' }, { status: 409 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  const { company, user } = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: parsed.data.companyName, slug: parsed.data.companySlug },
    })
    const user = await tx.user.create({
      data: {
        companyId: company.id,
        email: parsed.data.adminEmail,
        name: parsed.data.adminName,
        role: 'SYSTEM_ADMIN',
        passwordHash,
      },
    })
    return { company, user }
  })

  await writeAuditLog({
    companyId: company.id,
    actorId: user.id,
    action: 'COMPANY_CREATED',
    entityType: 'Company',
    entityId: company.id,
    payload: { companyName: company.name, slug: company.slug, adminEmail: user.email },
  })

  return NextResponse.json(
    { companyId: company.id, slug: company.slug, userId: user.id },
    { status: 201 }
  )
}
