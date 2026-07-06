import { createTransport } from 'nodemailer'

const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const FROM = `"M4U Travel" <${process.env.GMAIL_USER}>`
const APP = process.env.APP_URL ?? ''

function baseTemplate(content: string) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:32px 16px">
      <div style="background:#4f46e5;border-radius:12px 12px 0 0;padding:24px 32px">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px">M4U Travel</h1>
      </div>
      <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e5e7eb;border-top:none">
        ${content}
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">M4U Travel — automated notification. Do not reply to this email.</p>
    </div>
  `
}

function btn(href: string, label: string) {
  return `<p style="margin:28px 0 0"><a href="${href}" style="background:#4f46e5;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${label}</a></p>`
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px">${label}</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500">${value}</td></tr>`
}

function table(rows: string) {
  return `<table style="width:100%;border-collapse:collapse;margin-top:20px">${rows}</table>`
}

// ─── Auth emails ──────────────────────────────────────────────────────────────

export async function sendGoogleVerificationEmail(to: string, name: string, rawToken: string) {
  const link = `${APP}/api/auth/google-verify?token=${rawToken}`
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Confirm your Google login — M4U Travel',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Confirm your Google login</h2>
      <p style="color:#374151;margin:0">Hi ${name}, someone just signed in to your M4U Travel account using Google.</p>
      <p style="color:#374151;margin-top:8px">Click the button below to confirm it was you. After confirming, you can always sign in with Google instantly.</p>
      ${btn(link, 'Confirm Google login')}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">This link expires in 24 hours. If this wasn't you, ignore this email — your account is still safe.</p>
    `),
  })
}

export async function sendInviteEmail(to: string, name: string, rawToken: string, companySlug?: string) {
  const link = `${APP}/set-password?token=${rawToken}`
  const loginLink = companySlug ? `${APP}/login?company=${companySlug}` : `${APP}/login`
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'You have been invited to M4U Travel',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Welcome, ${name}!</h2>
      <p style="color:#374151;margin:0 0 4px">Your account has been created on M4U Travel.</p>
      <p style="color:#374151;margin:0">Click the button below to set your password and get started.</p>
      ${btn(link, 'Set your password')}
      ${companySlug ? `<p style="color:#6b7280;font-size:13px;margin-top:20px;padding:12px;background:#f3f4f6;border-radius:6px">
        After setting your password, log in at:<br/>
        <a href="${loginLink}" style="color:#4f46e5;font-weight:600">${loginLink}</a><br/>
        <span style="font-size:12px;color:#9ca3af">Company: <strong>${companySlug}</strong></span>
      </p>` : ''}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">This link expires in 48 hours. If you did not expect this email, you can ignore it.</p>
    `),
  })
}

export async function sendPasswordResetEmail(to: string, name: string, rawToken: string, companyName?: string) {
  const link = `${APP}/set-password?token=${rawToken}`
  const accountLabel = companyName ? ` for your account at <strong>${companyName}</strong>` : ''
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset your M4U Travel password',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Password reset request</h2>
      <p style="color:#374151;margin:0">Hi ${name}, we received a request to reset your M4U Travel password${accountLabel}.</p>
      ${btn(link, 'Reset your password')}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
    `),
  })
}

export async function sendSignupVerificationEmail(to: string, name: string, rawToken: string, companyName: string) {
  const link = `${APP}/api/auth/verify-email?token=${rawToken}`
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Verify your email — M4U Travel',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Verify your email address</h2>
      <p style="color:#374151;margin:0">Hi ${name}, thanks for registering <strong>${companyName}</strong> on M4U Travel.</p>
      <p style="color:#374151;margin-top:8px">Click the button below to verify your email address and activate your account.</p>
      ${btn(link, 'Verify my email')}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">This link expires in 24 hours. If you did not create this account, you can safely ignore this email.</p>
    `),
  })
}

// ─── Travel request emails ────────────────────────────────────────────────────

export async function emailRequestConfirmation(
  to: string,
  name: string,
  p: { origin: string; destination: string; departureDate: string; eventName: string; estimatedCostUsd?: number | null; requestId: string; nextStatus: string }
) {
  const nextLabel = p.nextStatus === 'PENDING_MANAGER' ? 'Awaiting manager approval' : 'Awaiting agent booking'
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Travel request submitted — ${p.origin} → ${p.destination}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Request submitted, ${name}!</h2>
      <p style="color:#374151;margin:0">Your travel request has been received and is being processed.</p>
      ${table(
        row('Route', `${p.origin} → ${p.destination}`) +
        row('Departure', p.departureDate) +
        row('Event', p.eventName) +
        (p.estimatedCostUsd ? row('Est. cost', `$${Number(p.estimatedCostUsd).toFixed(0)}`) : '') +
        row('Status', nextLabel)
      )}
      ${btn(`${APP}/employee/travel-requests`, 'View my requests')}
    `),
  })
}

export async function emailRequestCreatedOnBehalf(
  to: string,
  name: string,
  p: { origin: string; destination: string; departureDate: string; eventName: string; agentName: string; requestId: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'A travel request was created for you',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Travel request created, ${name}</h2>
      <p style="color:#374151;margin:0">Your travel agent <strong>${p.agentName}</strong> has created a travel request on your behalf.</p>
      ${table(
        row('Route', `${p.origin} → ${p.destination}`) +
        row('Departure', p.departureDate) +
        row('Event', p.eventName)
      )}
      <p style="color:#374151;margin-top:16px;font-size:14px">Booking options will be available for you to review shortly.</p>
      ${btn(`${APP}/employee/travel-requests`, 'View my requests')}
    `),
  })
}

export async function emailOptionsProvided(
  to: string,
  name: string,
  p: { destination: string; optionCount: number; requestId: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Your booking options are ready — ${p.destination}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Booking options ready, ${name}!</h2>
      <p style="color:#374151;margin:0"><strong>${p.optionCount} option${p.optionCount > 1 ? 's' : ''}</strong> are available for your trip to <strong>${p.destination}</strong>.</p>
      <p style="color:#374151;margin-top:12px">Please log in, review the options, and confirm your preference so your booking can proceed.</p>
      ${btn(`${APP}/employee/travel-requests/${p.requestId}`, 'Choose my options')}
    `),
  })
}

export async function emailPendingManagerApproval(
  to: string,
  managerName: string,
  p: { employeeName: string; origin: string; destination: string; departureDate: string; estimatedCostUsd?: number | null; requestId: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Approval required: ${p.employeeName}'s trip to ${p.destination}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Travel request pending approval</h2>
      <p style="color:#374151;margin:0">Hi ${managerName}, <strong>${p.employeeName}</strong> has submitted a travel request that requires your approval.</p>
      ${table(
        row('Employee', p.employeeName) +
        row('Route', `${p.origin} → ${p.destination}`) +
        row('Departure', p.departureDate) +
        (p.estimatedCostUsd ? row('Est. cost', `$${Number(p.estimatedCostUsd).toFixed(0)}`) : '')
      )}
      ${btn(`${APP}/manager/approvals/travel/${p.requestId}`, 'Review request')}
    `),
  })
}

export async function emailRequestApproved(
  to: string,
  name: string,
  p: { destination: string; requestId: string; actorName: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Your trip to ${p.destination} has been approved ✓`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Trip approved, ${name}!</h2>
      <p style="color:#374151;margin:0">Great news — your trip to <strong>${p.destination}</strong> has been approved by <strong>${p.actorName}</strong>.</p>
      <p style="color:#374151;margin-top:12px">Your travel agent will complete the booking shortly.</p>
      ${btn(`${APP}/employee/travel-requests/${p.requestId}`, 'View request')}
    `),
  })
}

export async function emailRequestRejected(
  to: string,
  name: string,
  p: { destination: string; rejectionNote?: string | null; requestId: string; actorName: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Your trip to ${p.destination} was not approved`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Request not approved, ${name}</h2>
      <p style="color:#374151;margin:0">Your travel request to <strong>${p.destination}</strong> was not approved by <strong>${p.actorName}</strong>.</p>
      ${p.rejectionNote ? `<div style="margin-top:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px"><p style="margin:0;font-size:13px;color:#991b1b"><strong>Reason:</strong> ${p.rejectionNote}</p></div>` : ''}
      <p style="color:#374151;margin-top:16px;font-size:14px">If you have questions, please contact your manager directly.</p>
      ${btn(`${APP}/employee/travel-requests/${p.requestId}`, 'View request')}
    `),
  })
}

export async function emailBookingConfirmed(
  to: string,
  name: string,
  p: { origin: string; destination: string; departureDate: string; confirmationNumber: string; requestId: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Booking confirmed — ${p.origin} → ${p.destination} 🎉`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">You're all set, ${name}!</h2>
      <p style="color:#374151;margin:0">Your trip has been booked and confirmed.</p>
      <div style="margin:24px 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;text-align:center">
        <p style="margin:0;font-size:12px;color:#15803d;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Confirmation number</p>
        <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#15803d;font-family:monospace">${p.confirmationNumber}</p>
      </div>
      ${table(
        row('Route', `${p.origin} → ${p.destination}`) +
        row('Departure', p.departureDate)
      )}
      <p style="color:#374151;margin-top:16px;font-size:14px">Save your confirmation number for check-in and travel records.</p>
      ${btn(`${APP}/employee/travel-requests/${p.requestId}`, 'View booking')}
    `),
  })
}

export async function emailAgentActionRequired(
  to: string,
  agentName: string,
  p: { employeeName: string; origin: string; destination: string; requestId: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Booking request — ${p.employeeName}: ${p.origin} → ${p.destination}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Action required, ${agentName}</h2>
      <p style="color:#374151;margin:0">A travel request is waiting for you to provide booking options.</p>
      ${table(
        row('Employee', p.employeeName) +
        row('Route', `${p.origin} → ${p.destination}`)
      )}
      ${btn(`${APP}/agent/requests/${p.requestId}`, 'Open request')}
    `),
  })
}

// ─── Expense emails ───────────────────────────────────────────────────────────

export async function emailExpenseToManager(
  to: string,
  managerName: string,
  p: { employeeName: string; amountUsd: number; category: string; description: string; eventCode: string; expenseId: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Expense for review — ${p.employeeName}, $${Number(p.amountUsd).toFixed(2)}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">New expense awaiting approval</h2>
      <p style="color:#374151;margin:0">Hi ${managerName}, <strong>${p.employeeName}</strong> has submitted an expense for your review.</p>
      ${table(
        row('Amount', `$${Number(p.amountUsd).toFixed(2)}`) +
        row('Category', p.category.replace(/_/g, ' ')) +
        row('Description', p.description) +
        row('Event', p.eventCode)
      )}
      ${btn(`${APP}/manager/approvals/expense/${p.expenseId}`, 'Review expense')}
    `),
  })
}

export async function emailExpenseApproved(
  to: string,
  name: string,
  p: { amountUsd: number; description: string; actorName: string; expenseId: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Expense approved — $${Number(p.amountUsd).toFixed(2)}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Expense approved, ${name}!</h2>
      <p style="color:#374151;margin:0">Your expense of <strong>$${Number(p.amountUsd).toFixed(2)}</strong> for <em>${p.description}</em> has been approved by <strong>${p.actorName}</strong>.</p>
      <p style="color:#374151;margin-top:12px;font-size:14px">It will be included in the next payout report.</p>
      ${btn(`${APP}/employee/expenses/${p.expenseId}`, 'View expense')}
    `),
  })
}

export async function emailExpenseRejected(
  to: string,
  name: string,
  p: { amountUsd: number; description: string; rejectionNote?: string | null; actorName: string; expenseId: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Expense not approved — $${Number(p.amountUsd).toFixed(2)}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Expense not approved, ${name}</h2>
      <p style="color:#374151;margin:0">Your expense of <strong>$${Number(p.amountUsd).toFixed(2)}</strong> for <em>${p.description}</em> was not approved by <strong>${p.actorName}</strong>.</p>
      ${p.rejectionNote ? `<div style="margin-top:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px"><p style="margin:0;font-size:13px;color:#991b1b"><strong>Reason:</strong> ${p.rejectionNote}</p></div>` : ''}
      ${btn(`${APP}/employee/expenses/${p.expenseId}`, 'View expense')}
    `),
  })
}

// ─── Finance emails ───────────────────────────────────────────────────────────

export async function emailExpenseToFinance(
  to: string,
  financeName: string,
  p: { employeeName: string; amountUsd: number; category: string; description: string; reason?: string | null; eventCode: string; approverName: string; expenseId: string }
) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Expense ready for payout — ${p.employeeName}, $${Number(p.amountUsd).toFixed(2)}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Expense ready for payout</h2>
      <p style="color:#374151;margin:0">Hi ${financeName}, an expense was approved by <strong>${p.approverName}</strong> and is ready for finance review &amp; payout.</p>
      ${table(
        row('Employee', p.employeeName) +
        row('Amount', `$${Number(p.amountUsd).toFixed(2)}`) +
        row('Category', p.category.replace(/_/g, ' ')) +
        (p.reason ? row('Reason', p.reason) : '') +
        row('Description', p.description) +
        row('Event', p.eventCode || '—') +
        row('Approved by', p.approverName)
      )}
      ${btn(`${APP}/finance/expenses`, 'Review & pay')}
    `),
  })
}

export async function emailFinanceDigest(
  to: string,
  financeName: string,
  p: { items: { employeeName: string; amountUsd: number; category: string; eventCode: string }[]; totalUsd: number; count: number }
) {
  const itemRows = p.items.map((it) =>
    `<tr>
      <td style="padding:6px 0;color:#111827;font-size:13px">${it.employeeName}</td>
      <td style="padding:6px 8px;color:#6b7280;font-size:13px">${it.category.replace(/_/g, ' ')}</td>
      <td style="padding:6px 8px;color:#6b7280;font-size:13px">${it.eventCode || '—'}</td>
      <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;text-align:right">$${Number(it.amountUsd).toFixed(2)}</td>
    </tr>`
  ).join('')
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `${p.count} expense${p.count !== 1 ? 's' : ''} ready for payout — $${Number(p.totalUsd).toFixed(2)}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Expenses ready for payout</h2>
      <p style="color:#374151;margin:0">Hi ${financeName}, <strong>${p.count}</strong> expense${p.count !== 1 ? 's were' : ' was'} approved in the last 24 hours and ${p.count !== 1 ? 'are' : 'is'} ready for finance review &amp; payout.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:20px">
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:6px 0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.04em">Employee</td>
          <td style="padding:6px 8px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.04em">Category</td>
          <td style="padding:6px 8px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.04em">Event</td>
          <td style="padding:6px 0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;text-align:right">Amount</td>
        </tr>
        ${itemRows}
        <tr style="border-top:2px solid #e5e7eb">
          <td colspan="3" style="padding:10px 0;color:#111827;font-size:13px;font-weight:700">Total</td>
          <td style="padding:10px 0;color:#111827;font-size:13px;font-weight:700;text-align:right">$${Number(p.totalUsd).toFixed(2)}</td>
        </tr>
      </table>
      ${btn(`${APP}/finance/expenses`, 'Review & pay')}
    `),
  })
}

// ─── Marketing / sales emails ─────────────────────────────────────────────────

export async function sendDemoRequest(
  p: { name: string; workEmail: string; company: string; message?: string | null }
) {
  const to = process.env.GMAIL_USER
  if (!to) return
  await transporter.sendMail({
    from: FROM,
    to,
    replyTo: p.workEmail,
    subject: `Demo request — ${p.company} (${p.name})`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">New demo request</h2>
      <p style="color:#374151;margin:0">A visitor has requested a demo via the website.</p>
      ${table(
        row('Name', p.name) +
        row('Work email', p.workEmail) +
        row('Company', p.company)
      )}
      ${p.message ? `<div style="margin-top:16px;background:#f3f4f6;border-radius:8px;padding:12px 16px"><p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap">${p.message}</p></div>` : ''}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">Reply directly to this email to reach ${p.name}.</p>
    `),
  })
}
