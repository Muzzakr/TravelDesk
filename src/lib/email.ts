import { createTransport } from 'nodemailer'
import { prisma } from './prisma'

// Shared transport — also used directly by mail.ts for the two marketing-site
// emails (newsletter welcome, demo request) that have no company/tenant
// context and so don't go through the logged sendEmail() path below.
export const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export const FROM = `"M4U Travel" <${process.env.GMAIL_USER}>`

export interface SendEmailParams {
  companyId: string
  /** Free-form tag like AuditLog.action, e.g. "TRAVEL_REQUEST_APPROVED" — not an enum, so new types never need a migration. */
  type: string
  to: string | string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  html: string
  triggeredByUserId?: string | null
  relatedEntityType?: string | null
  relatedEntityId?: string | null
}

export type SendEmailResult = { id: string; status: 'SENT' | 'FAILED' | 'SKIPPED' }

/**
 * Central dispatcher for every outbound email in the app. Logs every
 * attempt to EmailLog (powers /admin/emails) and honors per-company
 * per-type enable/disable settings. Never throws — email has always been
 * best-effort here (matches createNotification / the mail.ts call sites,
 * most of which wrap sends in `.catch(() => {})`).
 *
 * Returns the resulting status so the handful of call sites that treat
 * delivery as load-bearing (e.g. signup verification, which rolls back
 * account creation if the email can't be sent) can still check it —
 * everyone else can just ignore the return value.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const to = Array.isArray(params.to) ? params.to.filter(Boolean) : [params.to].filter(Boolean)
  if (to.length === 0) return { id: '', status: 'FAILED' }

  try {
    const setting = await prisma.emailNotificationSetting.findUnique({
      where: { companyId_type: { companyId: params.companyId, type: params.type } },
    })

    const base = {
      companyId: params.companyId,
      type: params.type,
      to,
      cc: params.cc ?? [],
      bcc: params.bcc ?? [],
      subject: params.subject,
      html: params.html,
      triggeredByUserId: params.triggeredByUserId ?? null,
      relatedEntityType: params.relatedEntityType ?? null,
      relatedEntityId: params.relatedEntityId ?? null,
    }

    if (setting && !setting.enabled) {
      const skipped = await prisma.emailLog.create({ data: { ...base, status: 'SKIPPED' } })
      return { id: skipped.id, status: 'SKIPPED' }
    }

    const log = await prisma.emailLog.create({ data: { ...base, status: 'PENDING' } })
    return await attemptSend(log.id)
  } catch (err) {
    console.error('sendEmail failed:', err)
    return { id: '', status: 'FAILED' }
  }
}

/**
 * Sends whatever is stored on an EmailLog row and updates its status.
 * Shared by the first-attempt path above, the admin "Retry" button, and
 * the retry cron — so a retry sends exactly what was originally rendered,
 * not a re-derivation from (possibly since-changed) live data.
 */
export async function attemptSend(logId: string): Promise<SendEmailResult> {
  const log = await prisma.emailLog.findUnique({ where: { id: logId } })
  if (!log) return { id: logId, status: 'FAILED' }

  try {
    await transporter.sendMail({
      from: FROM,
      to: log.to,
      cc: log.cc.length ? log.cc : undefined,
      bcc: log.bcc.length ? log.bcc : undefined,
      subject: log.subject,
      html: log.html,
    })
    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, errorMessage: null },
    })
    return { id: logId, status: 'SENT' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: 'FAILED', errorMessage: message.slice(0, 500), attempts: { increment: 1 } },
    })
    return { id: logId, status: 'FAILED' }
  }
}
