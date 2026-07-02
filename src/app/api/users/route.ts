import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { createVerificationToken } from '@/lib/tokens'
import { sendInviteEmail } from '@/lib/mail'
import { z } from 'zod'

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'TRAVEL_MANAGER', 'TRAVEL_AGENT', 'FINANCE_ADMIN', 'SYSTEM_ADMIN']),
  managerId: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SYSTEM_ADMIN', 'FINANCE_ADMIN', 'MANAGER', 'TRAVEL_MANAGER'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    select: { id: true, email: true, name: true, role: true, isActive: true, managerId: true, createdAt: true, passwordHash: true, manager: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users.map(({ passwordHash, ...u }) => ({ ...u, hasPassword: passwordHash !== null })))
}

const MANAGER_ALLOWED_ROLES = ['EMPLOYEE', 'TRAVEL_AGENT', 'FINANCE_ADMIN'] as const

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role ?? ''
  if (!['SYSTEM_ADMIN', 'MANAGER', 'TRAVEL_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (role === 'MANAGER' && !MANAGER_ALLOWED_ROLES.includes(parsed.data.role as typeof MANAGER_ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: 'Forbidden: cannot assign that role' }, { status: 403 })
  }

  const existing = await prisma.user.findUnique({
    where: { companyId_email: { companyId: session.user.companyId, email: parsed.data.email } },
  })
  if (existing) return NextResponse.json({ error: 'User already exists' }, { status: 409 })

  if (parsed.data.managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: parsed.data.managerId, companyId: session.user.companyId },
    })
    if (!manager) {
      return NextResponse.json({ error: 'Invalid managerId: user not found in this company' }, { status: 400 })
    }
  }

  const user = await prisma.user.create({
    data: {
      companyId: session.user.companyId,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      managerId: parsed.data.managerId ?? null,
      passwordHash: null,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    payload: { email: user.email, role: user.role },
  })

  let emailSent = false
  let setPasswordUrl: string | null = null

  try {
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { slug: true },
    })
    const companySlug = company?.slug ?? ''
    const rawToken = await createVerificationToken(user.id, 'INVITE')
    setPasswordUrl = `${process.env.APP_URL ?? ''}/set-password?token=${rawToken}`
    await sendInviteEmail(user.email, user.name, rawToken, companySlug)
    emailSent = true
  } catch (err) {
    console.error('Failed to send invite email:', err)
  }

  return NextResponse.json({ ...user, emailSent, setPasswordUrl }, { status: 201 })
}
