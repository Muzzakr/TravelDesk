import { prisma } from './prisma'
import { createNotification } from './notifications'
import { emailCardChargeNeedsInfo } from './mail'

// Fired whenever one or more card transactions become newly assigned to an
// employee — a weekly import auto-assigning via CardMapping, a mapping
// applied retroactively, or Finance manually assigning one. Batches into a
// single notification/email per employee rather than one per transaction,
// so mapping a card that retroactively assigns 20 old transactions doesn't
// flood someone's inbox.
export async function notifyCardChargesAssigned(companyId: string, employeeId: string, count: number): Promise<void> {
  if (count <= 0) return

  const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: { name: true, email: true } })
  if (!employee) return

  await createNotification({
    companyId,
    userId: employeeId,
    type: 'CARD_CHARGE_NEEDS_INFO',
    title: count === 1 ? 'A card charge needs your input' : `${count} card charges need your input`,
    description: 'Add the event and a receipt so it can be reconciled.',
    href: '/employee/card-charges',
  })

  try {
    await emailCardChargeNeedsInfo(employee.email, employee.name, count, companyId)
  } catch (err) {
    console.error('emailCardChargeNeedsInfo failed:', err)
  }
}
