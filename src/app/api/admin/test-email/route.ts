import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createTransport } from 'nodemailer'

export async function POST() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

  if (!user || !pass) {
    return NextResponse.json({ error: 'GMAIL_USER or GMAIL_APP_PASSWORD not set in environment variables.' }, { status: 500 })
  }

  const transporter = createTransport({ service: 'gmail', auth: { user, pass } })

  try {
    await transporter.sendMail({
      from: `"M4U Travel" <${user}>`,
      to: user,
      subject: '✅ M4U Travel — Email test successful',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
          <div style="background:#4f46e5;border-radius:12px 12px 0 0;padding:24px 32px">
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">M4U Travel</h1>
          </div>
          <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e5e7eb;border-top:none">
            <h2 style="color:#111827;margin:0 0 12px">Email is working! ✅</h2>
            <p style="color:#6b7280;font-size:14px;line-height:1.6">
              This is a test email sent from M4U Travel to confirm that Gmail SMTP is configured correctly.
            </p>
            <table style="width:100%;border-collapse:collapse;margin-top:20px">
              <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px">GMAIL_USER</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500">${user}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">APP_URL</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500">${appUrl}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Sent at</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500">${new Date().toISOString()}</td></tr>
            </table>
            ${appUrl.includes('localhost') ? `<p style="margin-top:20px;padding:12px;background:#fef3c7;border-radius:8px;color:#92400e;font-size:13px">⚠️ APP_URL is set to localhost. Update it to your Vercel URL so invite links work in production.</p>` : ''}
          </div>
        </div>
      `,
    })
    return NextResponse.json({ success: true, sentTo: user, appUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
