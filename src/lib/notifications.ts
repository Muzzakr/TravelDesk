import { prisma } from './prisma'

export type NotificationInput = {
  companyId: string
  userId: string
  type: string
  title: string
  description: string
  href: string
}

// Create an in-app notification. Fire-and-forget: a failure here must never
// block the underlying action (approval, submission, etc.).
export async function createNotification(n: NotificationInput): Promise<void> {
  try {
    await prisma.notification.create({ data: { ...n, read: false } })
  } catch (err) {
    console.error('createNotification failed:', err)
  }
}

// Same payload to several recipients (e.g. all finance admins).
export async function notifyUsers(userIds: string[], n: Omit<NotificationInput, 'userId'>): Promise<void> {
  await Promise.all(userIds.map((userId) => createNotification({ ...n, userId })))
}
