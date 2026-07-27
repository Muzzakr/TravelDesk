import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import * as mail from '@/lib/mail'

const SAMPLE_NAME = 'Jordan Rivera'
const SAMPLE_TOKEN = 'sample-token'

// Maps every email `type` tag to a call of its pure renderX() with
// representative sample data — used by the admin "Preview" feature so a
// template can be inspected without actually sending anything.
function renderSample(type: string): { subject: string; html: string } | null {
  switch (type) {
    case 'GOOGLE_VERIFY': return mail.renderGoogleVerificationEmail(SAMPLE_NAME, SAMPLE_TOKEN)
    case 'INVITE': return mail.renderInviteEmail(SAMPLE_NAME, SAMPLE_TOKEN, 'acme')
    case 'PASSWORD_RESET': return mail.renderPasswordResetEmail(SAMPLE_NAME, SAMPLE_TOKEN, 'Acme Events')
    case 'SIGNUP_VERIFY': return mail.renderSignupVerificationEmail(SAMPLE_NAME, SAMPLE_TOKEN, 'Acme Events')
    case 'MAGIC_LINK': return mail.renderMagicLinkEmail(SAMPLE_NAME, SAMPLE_TOKEN, 'Acme Events')

    case 'TRAVEL_REQUEST_SUBMITTED': return mail.renderRequestConfirmation(SAMPLE_NAME, { origin: 'JFK', destination: 'LAX', departureDate: '2026-08-01', eventName: 'Summer Gala', estimatedCostUsd: 850, requestId: 'sample', nextStatus: 'PENDING_MANAGER' })
    case 'TRAVEL_REQUEST_CREATED_ON_BEHALF': return mail.renderRequestCreatedOnBehalf(SAMPLE_NAME, { origin: 'JFK', destination: 'LAX', departureDate: '2026-08-01', eventName: 'Summer Gala', agentName: 'Alex Agent', requestId: 'sample' })
    case 'TRAVEL_OPTIONS_READY': return mail.renderOptionsProvided(SAMPLE_NAME, { destination: 'LAX', optionCount: 3, requestId: 'sample' })
    case 'TRAVEL_PENDING_MANAGER_APPROVAL': return mail.renderPendingManagerApproval(SAMPLE_NAME, { employeeName: 'Sam Employee', origin: 'JFK', destination: 'LAX', departureDate: '2026-08-01', estimatedCostUsd: 850, requestId: 'sample' })
    case 'TRAVEL_REQUEST_APPROVED': return mail.renderRequestApproved(SAMPLE_NAME, { destination: 'LAX', requestId: 'sample', actorName: 'Morgan Manager' })
    case 'TRAVEL_REQUEST_REJECTED': return mail.renderRequestRejected(SAMPLE_NAME, { destination: 'LAX', rejectionNote: 'Over budget for this event', requestId: 'sample', actorName: 'Morgan Manager' })
    case 'TRAVEL_REQUEST_CANCELLED': return mail.renderTravelRequestCancelled(SAMPLE_NAME, { origin: 'JFK', destination: 'LAX', requestId: 'sample', actorName: 'Morgan Manager' })
    case 'TRAVEL_REQUEST_UPDATED': return mail.renderTravelRequestUpdated(SAMPLE_NAME, { origin: 'JFK', destination: 'LAX', requestId: 'sample' })
    case 'TRAVEL_BOOKING_CONFIRMED': return mail.renderBookingConfirmed(SAMPLE_NAME, { origin: 'JFK', destination: 'LAX', departureDate: '2026-08-01', confirmationNumber: 'UA-2026-8472', requestId: 'sample' })
    case 'TRAVEL_AGENT_ACTION_REQUIRED': return mail.renderAgentActionRequired(SAMPLE_NAME, { employeeName: 'Sam Employee', origin: 'JFK', destination: 'LAX', requestId: 'sample' })
    case 'EVENT_TRAVELER_ASSIGNED': return mail.renderTravelerAssigned(SAMPLE_NAME, { employeeName: 'Sam Employee', eventName: 'Summer Gala', requestId: 'sample', assigned: true })
    case 'EVENT_TRAVELER_REMOVED': return mail.renderTravelerAssigned(SAMPLE_NAME, { employeeName: 'Sam Employee', eventName: 'Summer Gala', requestId: 'sample', assigned: false })

    case 'EXPENSE_TO_MANAGER': return mail.renderExpenseToManager(SAMPLE_NAME, { employeeName: 'Sam Employee', amountUsd: 42.5, category: 'TRANSPORT', description: 'Airport taxi', eventCode: '460455', expenseId: 'sample' })
    case 'EXPENSE_APPROVED': return mail.renderExpenseApproved(SAMPLE_NAME, { amountUsd: 42.5, description: 'Airport taxi', actorName: 'Morgan Manager', expenseId: 'sample' })
    case 'EXPENSE_REJECTED': return mail.renderExpenseRejected(SAMPLE_NAME, { amountUsd: 42.5, description: 'Airport taxi', rejectionNote: 'Missing receipt', actorName: 'Morgan Manager', expenseId: 'sample' })
    case 'EXPENSE_UPDATED': return mail.renderExpenseUpdated(SAMPLE_NAME, { description: 'Airport taxi', expenseId: 'sample' })
    case 'EXPENSE_DELETED': return mail.renderExpenseDeleted(SAMPLE_NAME, { description: 'Airport taxi', amountUsd: 42.5 })
    case 'EXPENSE_PAID': return mail.renderExpensePaid(SAMPLE_NAME, { amountUsd: 42.5, description: 'Airport taxi', expenseId: 'sample' })

    case 'EVENT_CREATED': return mail.renderEventCreated(SAMPLE_NAME, { eventName: 'Summer Gala', eventCode: '460455', eventId: 'sample' })
    case 'EVENT_UPDATED': return mail.renderEventUpdated(SAMPLE_NAME, { eventName: 'Summer Gala', eventId: 'sample' })
    case 'EVENT_DELETED': return mail.renderEventDeleted(SAMPLE_NAME, { eventName: 'Summer Gala', eventCode: '460455' })
    case 'EVENT_ACTIVATED': return mail.renderEventStatusChanged(SAMPLE_NAME, { eventName: 'Summer Gala', eventId: 'sample', status: 'ACTIVE' })
    case 'EVENT_CLOSED': return mail.renderEventStatusChanged(SAMPLE_NAME, { eventName: 'Summer Gala', eventId: 'sample', status: 'CLOSED' })
    case 'EVENT_VENUE_CHANGED': return mail.renderVenueChanged(SAMPLE_NAME, { eventName: 'Summer Gala', eventId: 'sample', venue: 'Grand Hotel Ballroom' })
    case 'EVENT_BUDGET_UPDATED': return mail.renderBudgetUpdated(SAMPLE_NAME, { eventName: 'Summer Gala', eventId: 'sample', budgetUsd: 25000 })

    case 'EVENT_DOCUMENT_UPLOADED': return mail.renderDocumentUploaded(SAMPLE_NAME, { eventName: 'Summer Gala', fileName: 'vendor-contract.pdf', isCoi: false })
    case 'EVENT_COI_UPLOADED': return mail.renderDocumentUploaded(SAMPLE_NAME, { eventName: 'Summer Gala', fileName: 'certificate-of-insurance.pdf', isCoi: true })
    case 'EVENT_DOCUMENT_REMOVED': return mail.renderDocumentRemoved(SAMPLE_NAME, { eventName: 'Summer Gala', fileName: 'old-contract.pdf' })
    case 'EVENT_MISSING_COI': return mail.renderMissingCoi(SAMPLE_NAME, { eventName: 'Summer Gala', eventDate: '2026-08-15' })

    case 'FINANCE_EXPENSE_READY': return mail.renderExpenseToFinance(SAMPLE_NAME, { employeeName: 'Sam Employee', amountUsd: 42.5, category: 'TRANSPORT', description: 'Airport taxi', reason: 'Client visit', eventCode: '460455', approverName: 'Morgan Manager', expenseId: 'sample' })
    case 'FINANCE_DAILY_DIGEST': return mail.renderFinanceDigest(SAMPLE_NAME, { items: [{ employeeName: 'Sam Employee', amountUsd: 42.5, category: 'TRANSPORT', eventCode: '460455' }], totalUsd: 42.5, count: 1 })
    case 'FINANCE_REPORT_GENERATED': return mail.renderPayoutReportGenerated(SAMPLE_NAME, { reportId: 'sample', totalUsd: 1250.75, count: 8 })

    case 'USER_UPDATED': return mail.renderUserUpdated(SAMPLE_NAME, { changes: 'name, managerId' })
    case 'USER_ROLE_CHANGED': return mail.renderRoleChanged(SAMPLE_NAME, { newRole: 'TRAVEL_MANAGER' })
    case 'USER_DELETED': return mail.renderUserDeleted(SAMPLE_NAME)
    case 'USER_INVITATION_ACCEPTED': return mail.renderInvitationAccepted(SAMPLE_NAME, { newUserName: 'Sam Employee', newUserEmail: 'sam@example.com' })
    case 'USER_PASSWORD_CHANGED': return mail.renderPasswordChanged(SAMPLE_NAME)

    case 'SECURITY_NEW_DEVICE_LOGIN': return mail.renderNewDeviceLogin(SAMPLE_NAME, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', time: new Date().toISOString() })
    case 'SYSTEM_ANNOUNCEMENT': return mail.renderAnnouncement(SAMPLE_NAME, { subject: 'Scheduled maintenance this weekend', body: 'M4U Travel will be briefly unavailable Saturday 2-3 AM ET for scheduled maintenance.' })

    default: return null
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SYSTEM_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const type = new URL(req.url).searchParams.get('type')
  if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 })

  const rendered = renderSample(type)
  if (!rendered) return NextResponse.json({ error: 'Unknown email type' }, { status: 404 })

  return NextResponse.json(rendered)
}
