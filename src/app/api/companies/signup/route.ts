import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { createVerificationToken } from '@/lib/tokens'
import { sendSignupVerificationEmail } from '@/lib/mail'
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

  // Check if email already taken
  const emailTaken = await prisma.user.findFirst({ where: { email: parsed.data.adminEmail } })
  if (emailTaken) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })

  let company, user
  try {
    ;({ company, user } = await prisma.$transaction(async (tx) => {
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
          // Activated when the verification email link is clicked
          isActive: false,
        },
      })
      return { company, user }
    }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Email verification is mandatory — if we cannot send it the account would
  // be permanently locked, so roll back and let the user retry.
  try {
    const rawToken = await createVerificationToken(user.id, 'EMAIL_VERIFY')
    await sendSignupVerificationEmail(user.email, user.name, rawToken, company.name)
  } catch (err) {
    console.error('Signup verification email failed:', err)
    await prisma.company.delete({ where: { id: company.id } }).catch(() => {})
    return NextResponse.json(
      { error: 'Could not send the verification email. Please try again in a moment.' },
      { status: 500 }
    )
  }

  try {
    await writeAuditLog({
      companyId: company.id,
      actorId: user.id,
      action: 'COMPANY_CREATED',
      entityType: 'Company',
      entityId: company.id,
      payload: { companyName: company.name, slug: company.slug, adminEmail: user.email },
    })
  } catch (err) {
    // Account is already created — a logging failure must not fail the signup.
    console.error('Signup audit log failed:', err)
  }

  return NextResponse.json(
    { companyId: company.id, slug: company.slug, userId: user.id, verificationEmailSent: true },
    { status: 201 }
  )
}
