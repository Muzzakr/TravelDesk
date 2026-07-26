export type EventOwner = { id: string; name: string; email: string }

// Shared status → visual mapping used across the calendar chips/cards, the
// detail drawer, and the page's own badges — kept in one place so all three
// stay visually consistent.
export const EVENT_STATUS_BADGE: Record<string, 'blue' | 'green' | 'gray'> = {
  DRAFT: 'blue',
  ACTIVE: 'green',
  CLOSED: 'gray',
}

export const EVENT_STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-blue-400',
  ACTIVE: 'bg-green-500',
  CLOSED: 'bg-gray-400',
}

export const EVENT_STATUS_CHIP: Record<string, string> = {
  DRAFT: 'bg-blue-50 text-blue-700 border-blue-100',
  ACTIVE: 'bg-green-50 text-green-700 border-green-100',
  CLOSED: 'bg-gray-50 text-gray-500 border-gray-100',
}

export type EventRow = {
  id: string
  eventCode: string
  eventName: string
  status: string
  eventDate: string | null
  timing: string | null
  venue: string | null
  address: string | null
  assignedDj: string | null
  assignedMc: string | null
  salesPerson: string | null
  costCenter: string | null
  budgetUsd: number
  owner: EventOwner
  _count: { expenses: number }
}
