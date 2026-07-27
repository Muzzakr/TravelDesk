import { transporter, FROM, sendEmail } from './email'

// Base URL for all email links. Falls back to NEXTAUTH_URL (always set for
// auth to work) so links never render without a host; trailing slash stripped
// to avoid double slashes.
const APP = (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? '').replace(/\/+$/, '')

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

type Rendered = { subject: string; html: string }

// ─── Auth emails ──────────────────────────────────────────────────────────────

export function renderGoogleVerificationEmail(name: string, rawToken: string): Rendered {
  const link = `${APP}/api/auth/google-verify?token=${rawToken}`
  return {
    subject: 'Confirm your Google login — M4U Travel',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Confirm your Google login</h2>
      <p style="color:#374151;margin:0">Hi ${name}, someone just signed in to your M4U Travel account using Google.</p>
      <p style="color:#374151;margin-top:8px">Click the button below to confirm it was you. After confirming, you can always sign in with Google instantly.</p>
      ${btn(link, 'Confirm Google login')}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">This link expires in 24 hours. If this wasn't you, ignore this email — your account is still safe.</p>
    `),
  }
}

export async function sendGoogleVerificationEmail(
  to: string, name: string, rawToken: string, companyId: string
) {
  return sendEmail({ companyId, type: 'GOOGLE_VERIFY', to, ...renderGoogleVerificationEmail(name, rawToken) })
}

export function renderInviteEmail(name: string, rawToken: string, companySlug?: string): Rendered {
  const link = `${APP}/set-password?token=${rawToken}`
  const loginLink = companySlug ? `${APP}/login?company=${companySlug}` : `${APP}/login`
  return {
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
  }
}

export async function sendInviteEmail(
  to: string, name: string, rawToken: string, companySlug: string | undefined, companyId: string
) {
  return sendEmail({ companyId, type: 'INVITE', to, ...renderInviteEmail(name, rawToken, companySlug) })
}

export function renderPasswordResetEmail(name: string, rawToken: string, companyName?: string): Rendered {
  const link = `${APP}/set-password?token=${rawToken}`
  const accountLabel = companyName ? ` for your account at <strong>${companyName}</strong>` : ''
  return {
    subject: 'Reset your M4U Travel password',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Password reset request</h2>
      <p style="color:#374151;margin:0">Hi ${name}, we received a request to reset your M4U Travel password${accountLabel}.</p>
      ${btn(link, 'Reset your password')}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
    `),
  }
}

export async function sendPasswordResetEmail(
  to: string, name: string, rawToken: string, companyName: string | undefined, companyId: string
) {
  return sendEmail({ companyId, type: 'PASSWORD_RESET', to, ...renderPasswordResetEmail(name, rawToken, companyName) })
}

export function renderSignupVerificationEmail(name: string, rawToken: string, companyName: string): Rendered {
  const link = `${APP}/api/auth/verify-email?token=${rawToken}`
  return {
    subject: 'Verify your email — M4U Travel',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Verify your email address</h2>
      <p style="color:#374151;margin:0">Hi ${name}, thanks for registering <strong>${companyName}</strong> on M4U Travel.</p>
      <p style="color:#374151;margin-top:8px">Click the button below to verify your email address and activate your account.</p>
      ${btn(link, 'Verify my email')}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">This link expires in 24 hours. If you did not create this account, you can safely ignore this email.</p>
    `),
  }
}

export async function sendSignupVerificationEmail(
  to: string, name: string, rawToken: string, companyName: string, companyId: string
) {
  return sendEmail({ companyId, type: 'SIGNUP_VERIFY', to, ...renderSignupVerificationEmail(name, rawToken, companyName) })
}

// ─── Travel request emails ────────────────────────────────────────────────────

export function renderRequestConfirmation(
  name: string,
  p: { origin: string; destination: string; departureDate: string; eventName: string; estimatedCostUsd?: number | null; requestId: string; nextStatus: string }
): Rendered {
  const nextLabel = p.nextStatus === 'PENDING_MANAGER' ? 'Awaiting manager approval' : 'Awaiting agent booking'
  return {
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
  }
}

export async function emailRequestConfirmation(
  to: string, name: string,
  p: { origin: string; destination: string; departureDate: string; eventName: string; estimatedCostUsd?: number | null; requestId: string; nextStatus: string },
  companyId: string
) {
  return sendEmail({
    companyId, type: 'TRAVEL_REQUEST_SUBMITTED', to,
    relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId,
    ...renderRequestConfirmation(name, p),
  })
}

export function renderRequestCreatedOnBehalf(
  name: string,
  p: { origin: string; destination: string; departureDate: string; eventName: string; agentName: string; requestId: string }
): Rendered {
  return {
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
  }
}

export async function emailRequestCreatedOnBehalf(
  to: string, name: string,
  p: { origin: string; destination: string; departureDate: string; eventName: string; agentName: string; requestId: string },
  companyId: string
) {
  return sendEmail({
    companyId, type: 'TRAVEL_REQUEST_CREATED_ON_BEHALF', to,
    relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId,
    ...renderRequestCreatedOnBehalf(name, p),
  })
}

export function renderOptionsProvided(name: string, p: { destination: string; optionCount: number; requestId: string }): Rendered {
  return {
    subject: `Your booking options are ready — ${p.destination}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Booking options ready, ${name}!</h2>
      <p style="color:#374151;margin:0"><strong>${p.optionCount} option${p.optionCount > 1 ? 's' : ''}</strong> are available for your trip to <strong>${p.destination}</strong>.</p>
      <p style="color:#374151;margin-top:12px">Please log in, review the options, and confirm your preference so your booking can proceed.</p>
      ${btn(`${APP}/employee/travel-requests/${p.requestId}`, 'Choose my options')}
    `),
  }
}

export async function emailOptionsProvided(
  to: string, name: string, p: { destination: string; optionCount: number; requestId: string }, companyId: string
) {
  return sendEmail({
    companyId, type: 'TRAVEL_OPTIONS_READY', to,
    relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId,
    ...renderOptionsProvided(name, p),
  })
}

export function renderPendingManagerApproval(
  managerName: string,
  p: { employeeName: string; origin: string; destination: string; departureDate: string; estimatedCostUsd?: number | null; requestId: string }
): Rendered {
  return {
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
  }
}

export async function emailPendingManagerApproval(
  to: string, managerName: string,
  p: { employeeName: string; origin: string; destination: string; departureDate: string; estimatedCostUsd?: number | null; requestId: string },
  companyId: string
) {
  return sendEmail({
    companyId, type: 'TRAVEL_PENDING_MANAGER_APPROVAL', to,
    relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId,
    ...renderPendingManagerApproval(managerName, p),
  })
}

export function renderRequestApproved(name: string, p: { destination: string; requestId: string; actorName: string }): Rendered {
  return {
    subject: `Your trip to ${p.destination} has been approved ✓`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Trip approved, ${name}!</h2>
      <p style="color:#374151;margin:0">Great news — your trip to <strong>${p.destination}</strong> has been approved by <strong>${p.actorName}</strong>.</p>
      <p style="color:#374151;margin-top:12px">Your travel agent will complete the booking shortly.</p>
      ${btn(`${APP}/employee/travel-requests/${p.requestId}`, 'View request')}
    `),
  }
}

export async function emailRequestApproved(
  to: string, name: string, p: { destination: string; requestId: string; actorName: string }, companyId: string
) {
  return sendEmail({
    companyId, type: 'TRAVEL_REQUEST_APPROVED', to,
    relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId,
    ...renderRequestApproved(name, p),
  })
}

export function renderRequestRejected(
  name: string, p: { destination: string; rejectionNote?: string | null; requestId: string; actorName: string }
): Rendered {
  return {
    subject: `Your trip to ${p.destination} was not approved`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Request not approved, ${name}</h2>
      <p style="color:#374151;margin:0">Your travel request to <strong>${p.destination}</strong> was not approved by <strong>${p.actorName}</strong>.</p>
      ${p.rejectionNote ? `<div style="margin-top:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px"><p style="margin:0;font-size:13px;color:#991b1b"><strong>Reason:</strong> ${p.rejectionNote}</p></div>` : ''}
      <p style="color:#374151;margin-top:16px;font-size:14px">If you have questions, please contact your manager directly.</p>
      ${btn(`${APP}/employee/travel-requests/${p.requestId}`, 'View request')}
    `),
  }
}

export async function emailRequestRejected(
  to: string, name: string,
  p: { destination: string; rejectionNote?: string | null; requestId: string; actorName: string },
  companyId: string
) {
  return sendEmail({
    companyId, type: 'TRAVEL_REQUEST_REJECTED', to,
    relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId,
    ...renderRequestRejected(name, p),
  })
}

export function renderBookingConfirmed(
  name: string, p: { origin: string; destination: string; departureDate: string; confirmationNumber: string; requestId: string }
): Rendered {
  return {
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
  }
}

export async function emailBookingConfirmed(
  to: string, name: string,
  p: { origin: string; destination: string; departureDate: string; confirmationNumber: string; requestId: string },
  companyId: string
) {
  return sendEmail({
    companyId, type: 'TRAVEL_BOOKING_CONFIRMED', to,
    relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId,
    ...renderBookingConfirmed(name, p),
  })
}

export function renderAgentActionRequired(
  agentName: string, p: { employeeName: string; origin: string; destination: string; requestId: string }
): Rendered {
  return {
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
  }
}

export async function emailAgentActionRequired(
  to: string, agentName: string, p: { employeeName: string; origin: string; destination: string; requestId: string }, companyId: string
) {
  return sendEmail({
    companyId, type: 'TRAVEL_AGENT_ACTION_REQUIRED', to,
    relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId,
    ...renderAgentActionRequired(agentName, p),
  })
}

// ─── Expense emails ───────────────────────────────────────────────────────────

export function renderExpenseToManager(
  managerName: string,
  p: { employeeName: string; amountUsd: number; category: string; description: string; eventCode: string; expenseId: string }
): Rendered {
  return {
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
  }
}

export async function emailExpenseToManager(
  to: string, managerName: string,
  p: { employeeName: string; amountUsd: number; category: string; description: string; eventCode: string; expenseId: string },
  companyId: string
) {
  return sendEmail({
    companyId, type: 'EXPENSE_TO_MANAGER', to,
    relatedEntityType: 'Expense', relatedEntityId: p.expenseId,
    ...renderExpenseToManager(managerName, p),
  })
}

export function renderExpenseApproved(name: string, p: { amountUsd: number; description: string; actorName: string; expenseId: string }): Rendered {
  return {
    subject: `Expense approved — $${Number(p.amountUsd).toFixed(2)}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Expense approved, ${name}!</h2>
      <p style="color:#374151;margin:0">Your expense of <strong>$${Number(p.amountUsd).toFixed(2)}</strong> for <em>${p.description}</em> has been approved by <strong>${p.actorName}</strong>.</p>
      <p style="color:#374151;margin-top:12px;font-size:14px">It will be included in the next payout report.</p>
      ${btn(`${APP}/employee/expenses/${p.expenseId}`, 'View expense')}
    `),
  }
}

export async function emailExpenseApproved(
  to: string, name: string, p: { amountUsd: number; description: string; actorName: string; expenseId: string }, companyId: string
) {
  return sendEmail({
    companyId, type: 'EXPENSE_APPROVED', to,
    relatedEntityType: 'Expense', relatedEntityId: p.expenseId,
    ...renderExpenseApproved(name, p),
  })
}

export function renderExpenseRejected(
  name: string, p: { amountUsd: number; description: string; rejectionNote?: string | null; actorName: string; expenseId: string }
): Rendered {
  return {
    subject: `Expense not approved — $${Number(p.amountUsd).toFixed(2)}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Expense not approved, ${name}</h2>
      <p style="color:#374151;margin:0">Your expense of <strong>$${Number(p.amountUsd).toFixed(2)}</strong> for <em>${p.description}</em> was not approved by <strong>${p.actorName}</strong>.</p>
      ${p.rejectionNote ? `<div style="margin-top:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px"><p style="margin:0;font-size:13px;color:#991b1b"><strong>Reason:</strong> ${p.rejectionNote}</p></div>` : ''}
      ${btn(`${APP}/employee/expenses/${p.expenseId}`, 'View expense')}
    `),
  }
}

export async function emailExpenseRejected(
  to: string, name: string,
  p: { amountUsd: number; description: string; rejectionNote?: string | null; actorName: string; expenseId: string },
  companyId: string
) {
  return sendEmail({
    companyId, type: 'EXPENSE_REJECTED', to,
    relatedEntityType: 'Expense', relatedEntityId: p.expenseId,
    ...renderExpenseRejected(name, p),
  })
}

// ─── Finance emails ───────────────────────────────────────────────────────────

export function renderExpenseToFinance(
  financeName: string,
  p: { employeeName: string; amountUsd: number; category: string; description: string; reason?: string | null; eventCode: string; approverName: string; expenseId: string }
): Rendered {
  return {
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
  }
}

export async function emailExpenseToFinance(
  to: string, financeName: string,
  p: { employeeName: string; amountUsd: number; category: string; description: string; reason?: string | null; eventCode: string; approverName: string; expenseId: string },
  companyId: string
) {
  return sendEmail({
    companyId, type: 'FINANCE_EXPENSE_READY', to,
    relatedEntityType: 'Expense', relatedEntityId: p.expenseId,
    ...renderExpenseToFinance(financeName, p),
  })
}

export function renderFinanceDigest(
  financeName: string,
  p: { items: { employeeName: string; amountUsd: number; category: string; eventCode: string }[]; totalUsd: number; count: number }
): Rendered {
  const itemRows = p.items.map((it) =>
    `<tr>
      <td style="padding:6px 0;color:#111827;font-size:13px">${it.employeeName}</td>
      <td style="padding:6px 8px;color:#6b7280;font-size:13px">${it.category.replace(/_/g, ' ')}</td>
      <td style="padding:6px 8px;color:#6b7280;font-size:13px">${it.eventCode || '—'}</td>
      <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;text-align:right">$${Number(it.amountUsd).toFixed(2)}</td>
    </tr>`
  ).join('')
  return {
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
  }
}

export async function emailFinanceDigest(
  to: string, financeName: string,
  p: { items: { employeeName: string; amountUsd: number; category: string; eventCode: string }[]; totalUsd: number; count: number },
  companyId: string
) {
  return sendEmail({ companyId, type: 'FINANCE_DAILY_DIGEST', to, ...renderFinanceDigest(financeName, p) })
}

// ─── Travel request — new (Group B) ────────────────────────────────────────────

export function renderTravelRequestUpdated(name: string, p: { origin: string; destination: string; requestId: string }): Rendered {
  return {
    subject: `Travel request updated — ${p.origin} → ${p.destination}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Request updated, ${name}</h2>
      <p style="color:#374151;margin:0">Your travel request to <strong>${p.destination}</strong> was updated.</p>
      ${btn(`${APP}/employee/travel-requests/${p.requestId}`, 'View request')}
    `),
  }
}
export async function emailTravelRequestUpdated(
  to: string, name: string, p: { origin: string; destination: string; requestId: string }, companyId: string
) {
  return sendEmail({ companyId, type: 'TRAVEL_REQUEST_UPDATED', to, relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId, ...renderTravelRequestUpdated(name, p) })
}

export function renderTravelRequestCancelled(name: string, p: { origin: string; destination: string; requestId: string; actorName: string }): Rendered {
  return {
    subject: `Travel request cancelled — ${p.origin} → ${p.destination}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Request cancelled, ${name}</h2>
      <p style="color:#374151;margin:0">The travel request to <strong>${p.destination}</strong> was cancelled by <strong>${p.actorName}</strong>.</p>
      ${btn(`${APP}/employee/travel-requests/${p.requestId}`, 'View request')}
    `),
  }
}
export async function emailTravelRequestCancelled(
  to: string, name: string, p: { origin: string; destination: string; requestId: string; actorName: string }, companyId: string
) {
  return sendEmail({ companyId, type: 'TRAVEL_REQUEST_CANCELLED', to, relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId, ...renderTravelRequestCancelled(name, p) })
}

export function renderTravelerAssigned(name: string, p: { employeeName: string; eventName: string; requestId: string; assigned: boolean }): Rendered {
  return {
    subject: p.assigned
      ? `${p.employeeName} was added as a traveler — ${p.eventName}`
      : `${p.employeeName} was removed as a traveler — ${p.eventName}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">${p.assigned ? 'Traveler assigned' : 'Traveler removed'}</h2>
      <p style="color:#374151;margin:0">Hi ${name}, <strong>${p.employeeName}</strong> was ${p.assigned ? 'assigned to' : 'removed from'} <strong>${p.eventName}</strong> as a traveler.</p>
      ${btn(`${APP}/manager/approvals/travel/${p.requestId}`, 'View request')}
    `),
  }
}
export async function emailTravelerAssigned(
  to: string, name: string, p: { employeeName: string; eventName: string; requestId: string; assigned: boolean }, companyId: string
) {
  return sendEmail({
    companyId, type: p.assigned ? 'EVENT_TRAVELER_ASSIGNED' : 'EVENT_TRAVELER_REMOVED', to,
    relatedEntityType: 'TravelRequest', relatedEntityId: p.requestId,
    ...renderTravelerAssigned(name, p),
  })
}

// ─── Expense — new (Group B) ───────────────────────────────────────────────────

export function renderExpenseUpdated(name: string, p: { description: string; expenseId: string }): Rendered {
  return {
    subject: `Expense updated — ${p.description}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Expense updated, ${name}</h2>
      <p style="color:#374151;margin:0">Your expense "<strong>${p.description}</strong>" was updated.</p>
      ${btn(`${APP}/employee/expenses/${p.expenseId}`, 'View expense')}
    `),
  }
}
export async function emailExpenseUpdated(to: string, name: string, p: { description: string; expenseId: string }, companyId: string) {
  return sendEmail({ companyId, type: 'EXPENSE_UPDATED', to, relatedEntityType: 'Expense', relatedEntityId: p.expenseId, ...renderExpenseUpdated(name, p) })
}

export function renderExpenseDeleted(name: string, p: { description: string; amountUsd: number }): Rendered {
  return {
    subject: `Expense deleted — ${p.description}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Expense deleted, ${name}</h2>
      <p style="color:#374151;margin:0">Your draft expense "<strong>${p.description}</strong>" ($${p.amountUsd.toFixed(2)}) was deleted.</p>
    `),
  }
}
export async function emailExpenseDeleted(to: string, name: string, p: { description: string; amountUsd: number }, companyId: string) {
  return sendEmail({ companyId, type: 'EXPENSE_DELETED', to, ...renderExpenseDeleted(name, p) })
}

export function renderExpensePaid(name: string, p: { amountUsd: number; description: string; expenseId: string }): Rendered {
  return {
    subject: `Expense paid — $${p.amountUsd.toFixed(2)}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">You've been paid, ${name}!</h2>
      <p style="color:#374151;margin:0">Your expense of <strong>$${p.amountUsd.toFixed(2)}</strong> for <em>${p.description}</em> has been paid out.</p>
      ${btn(`${APP}/employee/expenses/${p.expenseId}`, 'View expense')}
    `),
  }
}
export async function emailExpensePaid(to: string, name: string, p: { amountUsd: number; description: string; expenseId: string }, companyId: string) {
  return sendEmail({ companyId, type: 'EXPENSE_PAID', to, relatedEntityType: 'Expense', relatedEntityId: p.expenseId, ...renderExpensePaid(name, p) })
}

// ─── Events — new (Group B) ────────────────────────────────────────────────────

export function renderEventCreated(name: string, p: { eventName: string; eventCode: string; eventId: string }): Rendered {
  return {
    subject: `Event created — ${p.eventName}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Event created, ${name}</h2>
      <p style="color:#374151;margin:0"><strong>${p.eventName}</strong> (${p.eventCode}) was created.</p>
      ${btn(`${APP}/admin/events`, 'View events')}
    `),
  }
}
export async function emailEventCreated(to: string, name: string, p: { eventName: string; eventCode: string; eventId: string }, companyId: string) {
  return sendEmail({ companyId, type: 'EVENT_CREATED', to, relatedEntityType: 'Event', relatedEntityId: p.eventId, ...renderEventCreated(name, p) })
}

export function renderEventUpdated(name: string, p: { eventName: string; eventId: string }): Rendered {
  return {
    subject: `Event updated — ${p.eventName}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Event updated, ${name}</h2>
      <p style="color:#374151;margin:0"><strong>${p.eventName}</strong> was updated.</p>
      ${btn(`${APP}/admin/events`, 'View events')}
    `),
  }
}
export async function emailEventUpdated(to: string, name: string, p: { eventName: string; eventId: string }, companyId: string) {
  return sendEmail({ companyId, type: 'EVENT_UPDATED', to, relatedEntityType: 'Event', relatedEntityId: p.eventId, ...renderEventUpdated(name, p) })
}

export function renderEventDeleted(name: string, p: { eventName: string; eventCode: string }): Rendered {
  return {
    subject: `Event deleted — ${p.eventName}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Event deleted, ${name}</h2>
      <p style="color:#374151;margin:0"><strong>${p.eventName}</strong> (${p.eventCode}) was deleted.</p>
    `),
  }
}
export async function emailEventDeleted(to: string, name: string, p: { eventName: string; eventCode: string }, companyId: string) {
  return sendEmail({ companyId, type: 'EVENT_DELETED', to, ...renderEventDeleted(name, p) })
}

export function renderEventStatusChanged(name: string, p: { eventName: string; eventId: string; status: 'ACTIVE' | 'CLOSED' }): Rendered {
  const label = p.status === 'ACTIVE' ? 'activated' : 'closed'
  return {
    subject: `Event ${label} — ${p.eventName}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Event ${label}, ${name}</h2>
      <p style="color:#374151;margin:0"><strong>${p.eventName}</strong> was ${label}.</p>
      ${btn(`${APP}/admin/events`, 'View events')}
    `),
  }
}
export async function emailEventStatusChanged(
  to: string, name: string, p: { eventName: string; eventId: string; status: 'ACTIVE' | 'CLOSED' }, companyId: string
) {
  return sendEmail({
    companyId, type: p.status === 'ACTIVE' ? 'EVENT_ACTIVATED' : 'EVENT_CLOSED', to,
    relatedEntityType: 'Event', relatedEntityId: p.eventId,
    ...renderEventStatusChanged(name, p),
  })
}

export function renderVenueChanged(name: string, p: { eventName: string; eventId: string; venue: string }): Rendered {
  return {
    subject: `Venue changed — ${p.eventName}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Venue changed, ${name}</h2>
      <p style="color:#374151;margin:0">The venue for <strong>${p.eventName}</strong> is now <strong>${p.venue}</strong>.</p>
      ${btn(`${APP}/admin/events`, 'View events')}
    `),
  }
}
export async function emailVenueChanged(to: string, name: string, p: { eventName: string; eventId: string; venue: string }, companyId: string) {
  return sendEmail({ companyId, type: 'EVENT_VENUE_CHANGED', to, relatedEntityType: 'Event', relatedEntityId: p.eventId, ...renderVenueChanged(name, p) })
}

export function renderBudgetUpdated(name: string, p: { eventName: string; eventId: string; budgetUsd: number }): Rendered {
  return {
    subject: `Budget updated — ${p.eventName}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Budget updated, ${name}</h2>
      <p style="color:#374151;margin:0">The budget for <strong>${p.eventName}</strong> is now <strong>$${p.budgetUsd.toLocaleString()}</strong>.</p>
      ${btn(`${APP}/admin/events`, 'View events')}
    `),
  }
}
export async function emailBudgetUpdated(to: string, name: string, p: { eventName: string; eventId: string; budgetUsd: number }, companyId: string) {
  return sendEmail({ companyId, type: 'EVENT_BUDGET_UPDATED', to, relatedEntityType: 'Event', relatedEntityId: p.eventId, ...renderBudgetUpdated(name, p) })
}

// ─── Documents & COI — new (Group B/C) ─────────────────────────────────────────

export function renderDocumentUploaded(name: string, p: { eventName: string; fileName: string; isCoi: boolean }): Rendered {
  return {
    subject: p.isCoi ? `COI uploaded — ${p.eventName}` : `Document uploaded — ${p.eventName}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">${p.isCoi ? 'COI' : 'Document'} uploaded, ${name}</h2>
      <p style="color:#374151;margin:0"><strong>${p.fileName}</strong> was uploaded for <strong>${p.eventName}</strong>.</p>
      ${btn(`${APP}/admin/events`, 'View event')}
    `),
  }
}
export async function emailDocumentUploaded(
  to: string, name: string, p: { eventName: string; fileName: string; isCoi: boolean; eventId: string }, companyId: string
) {
  return sendEmail({
    companyId, type: p.isCoi ? 'EVENT_COI_UPLOADED' : 'EVENT_DOCUMENT_UPLOADED', to,
    relatedEntityType: 'Event', relatedEntityId: p.eventId,
    ...renderDocumentUploaded(name, p),
  })
}

export function renderDocumentRemoved(name: string, p: { eventName: string; fileName: string }): Rendered {
  return {
    subject: `Document removed — ${p.eventName}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Document removed, ${name}</h2>
      <p style="color:#374151;margin:0"><strong>${p.fileName}</strong> was removed from <strong>${p.eventName}</strong>.</p>
    `),
  }
}
export async function emailDocumentRemoved(to: string, name: string, p: { eventName: string; fileName: string; eventId: string }, companyId: string) {
  return sendEmail({ companyId, type: 'EVENT_DOCUMENT_REMOVED', to, relatedEntityType: 'Event', relatedEntityId: p.eventId, ...renderDocumentRemoved(name, p) })
}

export function renderMissingCoi(name: string, p: { eventName: string; eventDate: string }): Rendered {
  return {
    subject: `Missing COI — ${p.eventName}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Missing COI, ${name}</h2>
      <p style="color:#374151;margin:0"><strong>${p.eventName}</strong> (${p.eventDate}) has no Certificate of Insurance on file yet.</p>
      ${btn(`${APP}/admin/events`, 'Upload COI')}
    `),
  }
}
export async function emailMissingCoi(to: string, name: string, p: { eventName: string; eventDate: string; eventId: string }, companyId: string) {
  return sendEmail({ companyId, type: 'EVENT_MISSING_COI', to, relatedEntityType: 'Event', relatedEntityId: p.eventId, ...renderMissingCoi(name, p) })
}

// ─── Finance — new (Group B) ───────────────────────────────────────────────────

export function renderPayoutReportGenerated(name: string, p: { reportId: string; totalUsd: number; count: number }): Rendered {
  return {
    subject: `Payout report generated — $${p.totalUsd.toFixed(2)}`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Payout report ready, ${name}</h2>
      <p style="color:#374151;margin:0">A payout report with <strong>${p.count}</strong> expense${p.count !== 1 ? 's' : ''} totaling <strong>$${p.totalUsd.toFixed(2)}</strong> was generated.</p>
      ${btn(`${APP}/finance/payout-reports`, 'View report')}
    `),
  }
}
export async function emailPayoutReportGenerated(to: string, name: string, p: { reportId: string; totalUsd: number; count: number }, companyId: string) {
  return sendEmail({ companyId, type: 'FINANCE_REPORT_GENERATED', to, relatedEntityType: 'PayoutReport', relatedEntityId: p.reportId, ...renderPayoutReportGenerated(name, p) })
}

// ─── Users — new (Group B) ─────────────────────────────────────────────────────

export function renderUserUpdated(name: string, p: { changes: string }): Rendered {
  return {
    subject: 'Your account was updated',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Account updated, ${name}</h2>
      <p style="color:#374151;margin:0">Your M4U Travel account was updated by an administrator. Changed: <strong>${p.changes}</strong>.</p>
    `),
  }
}
export async function emailUserUpdated(to: string, name: string, p: { changes: string; userId: string }, companyId: string) {
  return sendEmail({ companyId, type: 'USER_UPDATED', to, relatedEntityType: 'User', relatedEntityId: p.userId, ...renderUserUpdated(name, p) })
}

export function renderRoleChanged(name: string, p: { newRole: string }): Rendered {
  return {
    subject: 'Your role has changed',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Role changed, ${name}</h2>
      <p style="color:#374151;margin:0">Your role on M4U Travel is now <strong>${p.newRole.replace(/_/g, ' ')}</strong>.</p>
    `),
  }
}
export async function emailRoleChanged(to: string, name: string, p: { newRole: string; userId: string }, companyId: string) {
  return sendEmail({ companyId, type: 'USER_ROLE_CHANGED', to, relatedEntityType: 'User', relatedEntityId: p.userId, ...renderRoleChanged(name, p) })
}

export function renderUserDeleted(name: string): Rendered {
  return {
    subject: 'Your account has been removed',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Account removed</h2>
      <p style="color:#374151;margin:0">Hi ${name}, your M4U Travel account has been removed by an administrator. If you believe this is a mistake, contact your company admin.</p>
    `),
  }
}
export async function emailUserDeleted(to: string, name: string, companyId: string) {
  return sendEmail({ companyId, type: 'USER_DELETED', to, ...renderUserDeleted(name) })
}

export function renderInvitationAccepted(name: string, p: { newUserName: string; newUserEmail: string }): Rendered {
  return {
    subject: `${p.newUserName} accepted their invitation`,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Invitation accepted</h2>
      <p style="color:#374151;margin:0">Hi ${name}, <strong>${p.newUserName}</strong> (${p.newUserEmail}) accepted their invitation and is now active.</p>
      ${btn(`${APP}/admin/employees`, 'View team')}
    `),
  }
}
export async function emailInvitationAccepted(to: string, name: string, p: { newUserName: string; newUserEmail: string; userId: string }, companyId: string) {
  return sendEmail({ companyId, type: 'USER_INVITATION_ACCEPTED', to, relatedEntityType: 'User', relatedEntityId: p.userId, ...renderInvitationAccepted(name, p) })
}

export function renderPasswordChanged(name: string): Rendered {
  return {
    subject: 'Your password was changed',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Password changed, ${name}</h2>
      <p style="color:#374151;margin:0">Your M4U Travel password was just changed. If you didn't do this, contact your company admin immediately.</p>
    `),
  }
}
export async function emailPasswordChanged(to: string, name: string, companyId: string) {
  return sendEmail({ companyId, type: 'USER_PASSWORD_CHANGED', to, ...renderPasswordChanged(name) })
}

// ─── Security — new (Group C) ──────────────────────────────────────────────────

export function renderNewDeviceLogin(name: string, p: { userAgent: string; time: string }): Rendered {
  return {
    subject: 'New device sign-in — M4U Travel',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">New sign-in, ${name}</h2>
      <p style="color:#374151;margin:0">Your account was just signed in to from a device we haven't seen before.</p>
      ${table(row('Device', p.userAgent) + row('Time', p.time))}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">If this wasn't you, change your password immediately.</p>
    `),
  }
}
export async function emailNewDeviceLogin(to: string, name: string, p: { userAgent: string; time: string }, companyId: string) {
  return sendEmail({ companyId, type: 'SECURITY_NEW_DEVICE_LOGIN', to, ...renderNewDeviceLogin(name, p) })
}

export function renderAnnouncement(name: string, p: { subject: string; body: string }): Rendered {
  return {
    subject: p.subject,
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">${p.subject}</h2>
      <p style="color:#374151;margin:0;white-space:pre-wrap">${p.body}</p>
    `),
  }
}
export async function emailAnnouncement(to: string, name: string, p: { subject: string; body: string }, companyId: string) {
  return sendEmail({ companyId, type: 'SYSTEM_ANNOUNCEMENT', to, ...renderAnnouncement(name, p) })
}

// ─── Sign-in ──────────────────────────────────────────────────────────────────

export function renderMagicLinkEmail(name: string, rawToken: string, companyName: string): Rendered {
  const link = `${APP}/magic-link?token=${rawToken}`
  return {
    subject: 'Your sign-in link — M4U Travel',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Sign in to M4U Travel</h2>
      <p style="color:#374151;margin:0">Hi ${name}, click the button below to sign in to your account at <strong>${companyName}</strong> — no password needed.</p>
      ${btn(link, 'Sign in to M4U Travel')}
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">This link expires in 15 minutes and can only be used once. If you didn't request it, you can safely ignore this email.</p>
    `),
  }
}

export async function sendMagicLinkEmail(
  to: string, name: string, rawToken: string, companyName: string, companyId: string
) {
  return sendEmail({ companyId, type: 'MAGIC_LINK', to, ...renderMagicLinkEmail(name, rawToken, companyName) })
}

// ─── Marketing / sales emails (public site — no company/tenant context,
//     so these bypass sendEmail/EmailLog and send directly) ───────────────────

export async function sendNewsletterWelcomeEmail(to: string) {
  const unsubscribeLink = `${APP}/api/unsubscribe?email=${encodeURIComponent(to)}`
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Welcome to the M4U Travel newsletter',
    html: baseTemplate(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Thanks for subscribing!</h2>
      <p style="color:#374151;margin:0">You'll now receive occasional updates about M4U Travel — new features, travel management tips and product news.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">Didn't sign up, or changed your mind? <a href="${unsubscribeLink}" style="color:#6b7280">Unsubscribe here</a>.</p>
    `),
  })
}

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
