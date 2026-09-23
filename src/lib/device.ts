import { prisma } from './prisma'
import { emailNewDeviceLogin } from './mail'
import { clientIp } from './rate-limit'
import { createHash } from 'crypto'

// New-device detection: hash User-Agent + IP, compare against previously
// seen devices for this user. Best-effort — never blocks sign-in. Shared by
// every sign-in path (credentials, magic-link, SSO) that needs it.
export async function checkNewDevice(userId: string, companyId: string, name: string, email: string, request: Request | undefined) {
  try {
    const userAgent = request?.headers.get('user-agent') ?? 'unknown'
    const ip = request ? clientIp(request) : 'unknown'
    const deviceHash = createHash('sha256').update(`${userAgent}|${ip}`).digest('hex')

    const known = await prisma.knownLoginDevice.findUnique({
      where: { userId_deviceHash: { userId, deviceHash } },
    })
    if (known) {
      await prisma.knownLoginDevice.update({ where: { id: known.id }, data: { lastSeenAt: new Date() } })
      return
    }

    await prisma.knownLoginDevice.create({ data: { userId, deviceHash } })
    // Don't email on a user's very first-ever login — every device would be "new".
    const deviceCount = await prisma.knownLoginDevice.count({ where: { userId } })
    if (deviceCount > 1 && email) {
      emailNewDeviceLogin(email, name, { userAgent, time: new Date().toISOString() }, companyId).catch(() => {})
    }
  } catch (err) {
    console.error('checkNewDevice failed:', err)
  }
}
