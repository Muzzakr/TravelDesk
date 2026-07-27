// Every email "type" tag used by src/lib/mail.ts, grouped for the admin
// notification-settings UI. Free-form strings (matching AuditLog.action),
// not a Prisma enum, so adding a new trigger never needs a migration —
// just add it here so it shows up with a friendly label in /admin/emails.

export const EMAIL_TYPE_GROUPS: { group: string; types: { type: string; label: string }[] }[] = [
  {
    group: 'Auth',
    types: [
      { type: 'GOOGLE_VERIFY', label: 'Google login verification' },
      { type: 'INVITE', label: 'User invited' },
      { type: 'PASSWORD_RESET', label: 'Password reset requested' },
      { type: 'SIGNUP_VERIFY', label: 'Signup email verification' },
      { type: 'MAGIC_LINK', label: 'Magic link sign-in' },
    ],
  },
  {
    group: 'Users',
    types: [
      { type: 'USER_UPDATED', label: 'User updated' },
      { type: 'USER_ROLE_CHANGED', label: 'Role changed' },
      { type: 'USER_DELETED', label: 'User deleted' },
      { type: 'USER_INVITATION_ACCEPTED', label: 'Invitation accepted' },
      { type: 'USER_PASSWORD_CHANGED', label: 'Password changed' },
    ],
  },
  {
    group: 'Events',
    types: [
      { type: 'EVENT_CREATED', label: 'Event created' },
      { type: 'EVENT_UPDATED', label: 'Event updated' },
      { type: 'EVENT_DELETED', label: 'Event deleted' },
      { type: 'EVENT_ACTIVATED', label: 'Event activated' },
      { type: 'EVENT_CLOSED', label: 'Event closed' },
      { type: 'EVENT_VENUE_CHANGED', label: 'Venue changed' },
      { type: 'EVENT_BUDGET_UPDATED', label: 'Budget updated' },
      { type: 'EVENT_TRAVELER_ASSIGNED', label: 'Traveler assigned' },
      { type: 'EVENT_TRAVELER_REMOVED', label: 'Traveler removed' },
    ],
  },
  {
    group: 'Travel requests',
    types: [
      { type: 'TRAVEL_REQUEST_SUBMITTED', label: 'Request submitted' },
      { type: 'TRAVEL_REQUEST_CREATED_ON_BEHALF', label: 'Request created on behalf' },
      { type: 'TRAVEL_OPTIONS_READY', label: 'Booking options ready' },
      { type: 'TRAVEL_PENDING_MANAGER_APPROVAL', label: 'Pending manager approval' },
      { type: 'TRAVEL_REQUEST_APPROVED', label: 'Request approved' },
      { type: 'TRAVEL_REQUEST_REJECTED', label: 'Request rejected' },
      { type: 'TRAVEL_REQUEST_CANCELLED', label: 'Request cancelled' },
      { type: 'TRAVEL_REQUEST_UPDATED', label: 'Request updated' },
      { type: 'TRAVEL_BOOKING_CONFIRMED', label: 'Booking confirmed' },
      { type: 'TRAVEL_AGENT_ACTION_REQUIRED', label: 'Agent action required' },
    ],
  },
  {
    group: 'Expenses',
    types: [
      { type: 'EXPENSE_TO_MANAGER', label: 'Expense submitted (to manager)' },
      { type: 'EXPENSE_APPROVED', label: 'Expense approved' },
      { type: 'EXPENSE_REJECTED', label: 'Expense rejected' },
      { type: 'EXPENSE_UPDATED', label: 'Expense updated' },
      { type: 'EXPENSE_DELETED', label: 'Expense deleted' },
      { type: 'EXPENSE_PAID', label: 'Expense paid' },
    ],
  },
  {
    group: 'Documents & COI',
    types: [
      { type: 'EVENT_DOCUMENT_UPLOADED', label: 'Document uploaded' },
      { type: 'EVENT_DOCUMENT_REMOVED', label: 'Document removed' },
      { type: 'EVENT_COI_UPLOADED', label: 'COI uploaded' },
      { type: 'EVENT_MISSING_COI', label: 'Missing COI detected' },
    ],
  },
  {
    group: 'Finance',
    types: [
      { type: 'FINANCE_EXPENSE_READY', label: 'Expense ready for payout' },
      { type: 'FINANCE_DAILY_DIGEST', label: 'Daily payout digest' },
      { type: 'FINANCE_REPORT_GENERATED', label: 'Payout report generated' },
    ],
  },
  {
    group: 'Security & system',
    types: [
      { type: 'SECURITY_NEW_DEVICE_LOGIN', label: 'New device login' },
      { type: 'SYSTEM_ANNOUNCEMENT', label: 'System announcement' },
    ],
  },
]

export const ALL_EMAIL_TYPES = EMAIL_TYPE_GROUPS.flatMap((g) => g.types)

export function emailTypeLabel(type: string): string {
  return ALL_EMAIL_TYPES.find((t) => t.type === type)?.label ?? type
}
