import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public, unauthenticated — lets the login page proactively hide the
// password field / show an SSO button once a company slug is entered,
// instead of only failing at submit time with no explanation.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('company')
  if (!slug) return NextResponse.json({ ssoEnabled: false, ssoEnforced: false })

  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true } })
  if (!company) return NextResponse.json({ ssoEnabled: false, ssoEnforced: false })

  const config = await prisma.companySsoConfig.findUnique({
    where: { companyId: company.id },
    select: { enabled: true, enforced: true },
  })

  return NextResponse.json({
    ssoEnabled: config?.enabled ?? false,
    ssoEnforced: (config?.enabled && config?.enforced) ?? false,
  })
}
