import { PrismaClient, Role, EventStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Clear existing data (dependents first)
  await prisma.approvalAction.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.receipt.deleteMany()
  await prisma.bookingOption.deleteMany()
  await prisma.cardTransaction.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.travelRequest.deleteMany()
  await prisma.payoutReport.deleteMany()
  await prisma.policyRule.deleteMany()
  await prisma.event.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.user.deleteMany()
  await prisma.company.deleteMany()

  const company = await prisma.company.create({
    data: { name: 'M4U Events', slug: 'm4ueventsm', plan: 'enterprise' },
  })

  const passwordHash = await bcrypt.hash('Password123!', 12)

  // Create manager first so we can reference their ID
  const manager = await prisma.user.create({
    data: { companyId: company.id, email: 'manager@m4u.com', name: 'Sara Manager', role: Role.MANAGER, passwordHash },
  })

  await prisma.user.createMany({
    data: [
      { companyId: company.id, email: 'mus@gmail.com',         name: 'Muzammil',           role: Role.SYSTEM_ADMIN,   passwordHash, mfaEnabled: false },
      { companyId: company.id, email: 'employee@m4u.com',      name: 'Alex Employee',      role: Role.EMPLOYEE,       passwordHash, managerId: manager.id },
      { companyId: company.id, email: 'employee2@m4u.com',     name: 'Kim Employee',       role: Role.EMPLOYEE,       passwordHash, managerId: manager.id },
      { companyId: company.id, email: 'agent@m4u.com',         name: 'Travel Agent',       role: Role.TRAVEL_AGENT,   passwordHash },
      { companyId: company.id, email: 'finance@m4u.com',       name: 'Finance Admin',      role: Role.FINANCE_ADMIN,  passwordHash },
      // TRAVEL_MANAGER is distinct from MANAGER (see src/middleware.ts and
      // manager/approvals/travel/[id]/page.tsx): only TRAVEL_MANAGER/
      // SYSTEM_ADMIN get the inline "complete booking" step right after
      // approving a travel request. Missing from seed data entirely until
      // now — also the role e2e/helpers.ts APPROVER needs.
      { companyId: company.id, email: 'travelmanager@m4u.com', name: 'Taylor Travel Mgr',  role: Role.TRAVEL_MANAGER, passwordHash },
    ],
  })

  const adminUser = await prisma.user.findFirst({ where: { companyId: company.id, role: Role.SYSTEM_ADMIN } })
  const employees = await prisma.user.findMany({ where: { companyId: company.id, role: Role.EMPLOYEE } })

  // EMPLOYEE role is gated behind a complete TravelerProfile before they can
  // submit a travel request (see src/lib/profile-check.ts) — without this,
  // every employee lands on "Complete your profile first" instead of the
  // travel-request wizard.
  await prisma.travelerProfile.createMany({
    data: employees.map((u) => ({
      userId: u.id,
      companyId: company.id,
      firstName: u.name.split(' ')[0],
      lastName: u.name.split(' ').slice(1).join(' ') || u.name,
      phoneNumber: '+1-555-0100',
      passportNumber: 'X1234567',
      passportExpiry: new Date('2030-01-01'),
    })),
  })

  await prisma.event.createMany({
    data: [
      {
        companyId: company.id,
        eventCode: 'EVT-001',
        eventName: 'Q3 Kickoff',
        costCenter: 'CC-001',
        budgetUsd: 50000,
        dateStart: new Date('2026-08-01'),
        dateEnd: new Date('2026-08-05'),
        status: EventStatus.ACTIVE,
        ownerUserId: adminUser!.id,
      },
    ],
  })

  console.log('Seed complete!')
  console.log('  Company slug:        m4ueventsm')
  console.log('  mus@gmail.com        SYSTEM_ADMIN')
  console.log('  manager@m4u.com      MANAGER')
  console.log('  travelmanager@m4u.com TRAVEL_MANAGER')
  console.log('  employee@m4u.com     EMPLOYEE')
  console.log('  agent@m4u.com        TRAVEL_AGENT')
  console.log('  finance@m4u.com      FINANCE_ADMIN')
  console.log('  Password for all:    Password123!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
